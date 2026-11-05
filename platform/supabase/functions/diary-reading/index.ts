// diary-reading — her week, read, when it closes.
//
// Called by the diary in the browser (/app/diario) with her session, when
// she opens it. If the week that has just closed is due a reading -- ended
// (Sunday counts), kept at least three days, not read yet: journal_reading_due
// -- it is written now, by the same procedure as every reading
// (_shared/reading.ts): once per week, the model's text checked figure by
// figure, the fixed-sentence fallback otherwise. The diary then lists her
// readings through diary_readings; nothing is returned here but what
// happened.
//
// The model sees her figures and what she sells, never her name, e-mail or
// city.
//
// Secrets: those of _shared/reading.ts; SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import { spDate, weekToRead } from "../_shared/journal.ts";
import { weekTarget, writeReading } from "../_shared/reading.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "not_signed_in" }, 401);
  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: me } = await db.from("entrepreneurs").select("id").eq("profile_id", who.user.id).maybeSingle();
  if (!me) return json({ error: "not_enrolled" }, 403);

  const week = weekToRead(spDate(new Date()));
  const { data: due, error: dueError } = await db.rpc("journal_reading_due", {
    p_entrepreneur_id: me.id,
    p_week_start: week,
  });
  if (dueError) return json({ error: "unavailable" }, 503);
  if (!due) return json({ week_start: week, status: "not_due" });

  const { status, body } = await writeReading(db, weekTarget(String(me.id), week));
  if (body.busy) return json({ week_start: week, status: "busy" });
  if (status >= 500) {
    console.error("diary reading failed", week, body.error);
    return json({ week_start: week, status: "failed" }, 502);
  }
  return json({ week_start: week, status: "written", source: body.source });
});
