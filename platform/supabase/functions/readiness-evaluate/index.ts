// readiness-evaluate — runs the readiness engine for one entrepreneur and
// records the assessment.
//
//   POST { "entrepreneur_id": "<uuid>" }   with the caller's session
//
// Who may ask is decided by the database: readiness_inputs is called with the
// caller's own session and refuses anyone who is not the entrepreneur, a
// leader of hers or an admin. The engine then runs here — never in the
// browser — and the result is recorded with the service role, since clients
// never write a result. Asking again with nothing changed returns the latest
// assessment instead of attesting a new one.

import { createClient } from "@supabase/supabase-js";
import { assessReadiness, type ReadinessRawInput } from "../_shared/readiness-engine/index.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "not_signed_in" }, 401);

  let entrepreneurId: string;
  try {
    ({ entrepreneur_id: entrepreneurId } = await req.json());
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (typeof entrepreneurId !== "string" || !UUID.test(entrepreneurId)) {
    return json({ error: "invalid_entrepreneur_id" }, 400);
  }

  // As the caller: who they are, and what they are allowed to have assessed.
  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);

  const { data: raw, error: inputError } = await asCaller.rpc("readiness_inputs", {
    p_entrepreneur_id: entrepreneurId,
  });
  if (inputError) {
    const forbidden = inputError.message === "not_allowed_to_assess";
    return json({ error: inputError.message }, forbidden ? 403 : 500);
  }

  let assessed;
  try {
    assessed = assessReadiness(raw as ReadinessRawInput);
  } catch (err) {
    // The database validates what it stores, so this means the two disagree.
    return json({ error: `engine_rejected_input: ${err instanceof Error ? err.message : err}` }, 500);
  }

  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data: recorded, error: recordError } = await service.rpc("record_readiness_assessment", {
    p_entrepreneur_id: entrepreneurId,
    p_features: assessed.features,
    p_result: assessed.result,
    p_requested_by: who.user.id,
  });
  if (recordError) return json({ error: `recording_failed: ${recordError.message}` }, 500);

  return json({ ...(recorded as Record<string, unknown>), result: assessed.result });
});
