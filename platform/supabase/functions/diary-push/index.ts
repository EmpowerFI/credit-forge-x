// diary-push — the diary's reminder, as a notification on her phone.
//
// Three doors:
//
//   GET                       the public VAPID key, which the browser needs to
//                             subscribe. Public by design; nothing else is.
//   POST + x-diary-push-secret from pg_cron every fifteen minutes
//                             (private.dispatch_diary_push): claims who is due
//                             (diary_push_claim -- reminders on, a device
//                             subscribed, her time reached, the day not
//                             recorded, not reminded today), pushes to each of
//                             her devices, and records what every push service
//                             answered (diary_push_finished). A failed push is
//                             not retried: one reminder a day, at most.
//   POST + her session,       one test notification to her own devices, so she
//     { "action": "test" }    can see it work. A few per hour.
//
// Standard Web Push (RFC 8030/8291/8292) through @negrel/webpush: no Firebase
// project, no paid service. The push services themselves are the browsers'
// (Google's for Chrome and Android, Apple's for Safari, Mozilla's, Microsoft's)
// and only those are ever called (isPushService). A notification carries no
// figure and no name. The log has counts and HTTP statuses, never an endpoint.
//
// Secrets: VAPID_KEYS_B64 and DIARY_PUSH_SECRET (scripts/diary/generate-push-keys.mts);
// optional VAPID_SUBJECT (default https://www.empowerfi.io); SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the runtime.
// Changing the VAPID keys orphans every subscription: generate them once per project.

import { createClient } from "@supabase/supabase-js";
import * as webpush from "@negrel/webpush";
import {
  decodeVapidKeys, isPushService, type Notification, outcomeOf, type PushOutcome, REMINDER_TTL_SECONDS,
  reminderNotification, type ReminderKind, TEST_TTL_SECONDS, testNotification,
} from "../_shared/push.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// Built once per instance: importing keys and making the server's ECDH pair.
let server: Promise<{ app: webpush.ApplicationServer; publicKey: string }> | null = null;
function appServer() {
  server ??= (async () => {
    const vapidKeys = await webpush.importVapidKeys(decodeVapidKeys(env("VAPID_KEYS_B64")), { extractable: false });
    const app = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get("VAPID_SUBJECT") || "https://www.empowerfi.io",
      vapidKeys,
    });
    return { app, publicKey: await webpush.exportApplicationServerKey(vapidKeys) };
  })();
  server.catch(() => {
    server = null;
  });
  return server;
}

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Result {
  subscription_id: string;
  status: PushOutcome;
  http_status: number | null;
  error: string | null;
}

async function push(sub: Subscription, n: Notification, ttl: number): Promise<Result> {
  const result = (status: PushOutcome, http: number | null, error: string | null): Result =>
    ({ subscription_id: sub.id, status, http_status: http, error });
  if (!isPushService(sub.endpoint)) return result("gone", null, "not a push service");
  try {
    const { app } = await appServer();
    await app.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
      .pushTextMessage(JSON.stringify(n), { ttl, topic: n.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) });
    return result("accepted", 201, null);
  } catch (e) {
    if (e instanceof webpush.PushMessageError) {
      const status = e.response.status;
      const why = (await e.response.text().catch(() => "")).slice(0, 200);
      return result(outcomeOf(status), status, why || e.response.statusText || null);
    }
    // A key the browser sent that does not decode, or the network: her device, not her data.
    return result("failed", null, e instanceof Error ? e.message.slice(0, 200) : "unknown");
  }
}

/** A few at a time: hundreds of women at 19h must not open hundreds of connections at once. */
async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  return out;
}

async function sendDue(): Promise<Response> {
  let reminders = 0;
  const tally: Record<PushOutcome, number> = { accepted: 0, failed: 0, gone: 0 };
  // Up to four claims a run; whoever is left is claimed fifteen minutes later.
  for (let round = 0; round < 4; round++) {
    const { data, error } = await db.rpc("diary_push_claim", { p_limit: 200 });
    if (error) {
      console.error("diary-push: claim failed", error.message);
      return json({ error: "claim failed" }, 500);
    }
    const due = (data ?? []) as { reminder_id: string; kind: ReminderKind; subscriptions: Subscription[] }[];
    if (due.length === 0) break;
    reminders += due.length;
    await inBatches(due, 20, async (r) => {
      const n = reminderNotification(r.kind, r.reminder_id);
      const results = await Promise.all(r.subscriptions.map((s) => push(s, n, REMINDER_TTL_SECONDS)));
      results.forEach((x) => tally[x.status]++);
      const { error: finishError } = await db.rpc("diary_push_finished", { p_reminder_id: r.reminder_id, p_results: results });
      if (finishError) console.error("diary-push: finished failed", finishError.message);
    });
  }
  console.log(`diary-push: ${reminders} reminders, ${tally.accepted} accepted, ${tally.failed} failed, ${tally.gone} gone`);
  return json({ reminders, ...tally });
}

// Per instance, which is enough to stop a stuck button from hammering her phone.
const recentTests = new Map<string, number[]>();
const TESTS_PER_HOUR = 5;

async function sendTest(authorization: string): Promise<Response> {
  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);
  const { data: me } = await db.from("entrepreneurs").select("id").eq("profile_id", who.user.id).maybeSingle();
  if (!me) return json({ error: "not_enrolled" }, 403);

  const now = Date.now();
  const recent = (recentTests.get(me.id) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= TESTS_PER_HOUR) return json({ error: "too_many_tests" }, 429);
  recentTests.set(me.id, [...recent, now]);

  const { data: subs, error } = await db.from("push_subscriptions")
    .select("id, endpoint, p256dh, auth").eq("entrepreneur_id", me.id).is("disabled_at", null);
  if (error) {
    console.error("diary-push: test lookup failed", error.message);
    return json({ error: "lookup failed" }, 500);
  }
  const results = await Promise.all(((subs ?? []) as Subscription[]).map((s) => push(s, testNotification(), TEST_TTL_SECONDS)));
  // A device the push service says is gone is dropped now, as a reminder would.
  const gone = results.filter((r) => r.status === "gone").map((r) => r.subscription_id);
  if (gone.length) {
    await db.from("push_subscriptions").update({ disabled_at: new Date().toISOString(), disabled_reason: "gone" }).in("id", gone);
  }
  return json({
    devices: results.length,
    accepted: results.filter((r) => r.status === "accepted").length,
    gone: gone.length,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") return json({ public_key: (await appServer()).publicKey });
    if (req.method !== "POST") return json({ error: "method" }, 405);

    const secret = req.headers.get("x-diary-push-secret");
    if (secret !== null) {
      if (!secretMatches(secret, env("DIARY_PUSH_SECRET"))) return json({ error: "forbidden" }, 403);
      return await sendDue();
    }
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "not_signed_in" }, 401);
    const body = await req.json().catch(() => ({})) as { action?: unknown };
    if (body.action !== "test") return json({ error: "bad_request" }, 400);
    return await sendTest(authorization);
  } catch (e) {
    console.error("diary-push:", e instanceof Error ? e.message : e);
    return json({ error: "unavailable" }, 503);
  }
});
