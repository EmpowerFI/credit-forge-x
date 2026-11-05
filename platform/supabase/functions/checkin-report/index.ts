// checkin-report — writes the reading of one month or one week, once.
//
// Two bodies, one procedure (_shared/reading.ts):
//   { checkin_id }                   an assembled month (ai_analyses)
//   { entrepreneur_id, week_start }  a week of the daily journal (journal_readings)
//
// Called by the platform with the service role key, and callable again for
// the same period at no cost: the second call returns the reading already
// written. Her diary asks for its weekly reading through diary-reading, with
// her session, not through here.
//
// Secrets: those of _shared/reading.ts; SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import { type Target, targetOf, writeReading } from "../_shared/reading.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(env("SUPABASE_URL"), SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Constant-time enough for a shared secret, never short-circuiting. */
function secretMatches(given: string, expected: string): boolean {
  if (given.length === 0 || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Only the platform itself calls this: it spends money on every new period.
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!secretMatches(bearer, SERVICE_KEY)) return json({ error: "forbidden" }, 403);

  let target: Target;
  try {
    target = targetOf(await req.json());
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
  const { status, body } = await writeReading(db, target);
  return json(body, status);
});
