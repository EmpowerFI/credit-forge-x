// reward-email — her reward's link, by e-mail.
//
// Called every five minutes by pg_cron (private.dispatch_reward_email, only
// when something is due) with a shared secret in x-reward-email-secret. It
// claims up to 50 e-mails (reward_emails_claim): a milestone with a link that
// she earned, or that EmpowerFI asked to send again from the dashboard. Each
// is sent through Resend, one at a time and spaced out, and what Resend
// answered is recorded (reward_email_finished). A failure is retried by the
// database, three attempts in all.
//
// Her address and the link are read from the database for the send and go
// nowhere else: the log carries counts and Resend's status codes only.
//
// Secrets: REWARD_EMAIL_SECRET (scripts/rewards/generate-reward-email-secret.mts),
// RESEND_API_KEY, RESEND_FROM_EMAIL; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// from the runtime. Migration 20270112000000_her_reward_link_comes_by_email.

import { createClient } from "@supabase/supabase-js";
import { outcomeOf, resendRequest, type RewardEmail } from "../_shared/reward-email.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Resend's default limit is a few requests a second: stay under it. */
const SPACING_MS = 600;
const PER_RUN = 50;

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get("x-reward-email-secret"), env("REWARD_EMAIL_SECRET"))) {
    return json({ error: "forbidden" }, 403);
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    // Nothing is claimed without a way to send: the next run finds them all again.
    console.warn("reward-email: RESEND_API_KEY / RESEND_FROM_EMAIL are not set");
    return json({ sent: 0, failed: 0, note: "not configured" });
  }
  const sender = from.includes("<") ? from : `EmpowerFI <${from}>`;
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  const { data, error } = await db.rpc("reward_emails_claim", { p_limit: PER_RUN });
  if (error) {
    console.error("reward-email: claim failed", error.code);
    return json({ error: "claim failed" }, 500);
  }
  const due = (data ?? []) as RewardEmail[];

  let sent = 0;
  let failed = 0;
  const statuses: Record<string, number> = {};
  for (const [i, r] of due.entries()) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, SPACING_MS));
    let id: string | null = null;
    let problem: string | null = null;
    try {
      const { url, init } = resendRequest(apiKey, sender, r);
      const res = await fetch(url, init);
      statuses[res.status] = (statuses[res.status] ?? 0) + 1;
      ({ id, error: problem } = await outcomeOf(res));
    } catch (e) {
      problem = e instanceof Error ? e.message.slice(0, 200) : "send failed";
    }
    const { error: finishError } = await db.rpc("reward_email_finished", { p_id: r.id, p_provider_id: id, p_error: problem });
    if (finishError) console.error("reward-email: finish failed", finishError.code);
    if (id) sent++;
    else failed++;
  }
  console.log("reward-email:", JSON.stringify({ claimed: due.length, sent, failed, statuses }));
  return json({ sent, failed });
});
