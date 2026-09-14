// eligibility-evaluate — runs the eligibility engine on an entrepreneur's
// active credit request and records it; if the request is not NOT_ELIGIBLE,
// the database turns it into a qualified opportunity and refers it.
//
//   POST { "entrepreneur_id": "<uuid>" }   with the caller's session
//
// eligibility_inputs is called with the caller's session: it refuses anyone
// who may not act for her, and anyone not in the credit pipeline — ready AND
// asked. Readiness alone never reaches this engine. The engine runs here and
// the result is recorded with the service role.

import { createClient } from "@supabase/supabase-js";
import { assessEligibility, type EligibilityInput } from "../_shared/eligibility-engine/index.ts";

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

  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);

  const { data: gathered, error: inputError } = await asCaller.rpc("eligibility_inputs", {
    p_entrepreneur_id: entrepreneurId,
  });
  if (inputError) {
    const status = inputError.message === "not_allowed_to_assess" ? 403
      : inputError.message === "not_in_credit_pipeline" ? 409 : 500;
    return json({ error: inputError.message }, status);
  }

  const { intent_id, readiness_assessment_id, input } = gathered as {
    intent_id: string;
    readiness_assessment_id: string;
    input: EligibilityInput;
  };

  let result;
  try {
    result = assessEligibility(input);
  } catch (err) {
    return json({ error: `engine_rejected_input: ${err instanceof Error ? err.message : err}` }, 500);
  }

  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data: recorded, error: recordError } = await service.rpc("record_eligibility_assessment", {
    p_entrepreneur_id: entrepreneurId,
    p_intent_id: intent_id,
    p_readiness_assessment_id: readiness_assessment_id,
    p_inputs: input,
    p_result: result,
  });
  if (recordError) return json({ error: `recording_failed: ${recordError.message}` }, 500);

  return json({ ...(recorded as Record<string, unknown>), result });
});
