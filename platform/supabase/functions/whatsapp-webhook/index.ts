// whatsapp-webhook — where a fortnight she typed on her phone becomes a row.
//
// Meta delivers a completed Flow here. Two things arrive and nothing else is
// acted on: the verification handshake Meta does once when the URL is
// registered, and a POST carrying one or more completed check-in Flows.
//
// Three refusals, in this order, before anything is written:
//
//   1. The signature. X-Hub-Signature-256 over the raw bytes, HMAC with the
//      app secret. Without it the URL is a public write to a woman's revenue.
//   2. The flow token. Single-use, expiring, and the only thing that says
//      which woman, which month and which half -- a Flow with no data
//      endpoint has nowhere else to carry it.
//   3. The figures. "1.234,56" is pt-BR; "1,234.56" is refused rather than
//      interpreted, because a comma read as a decimal point anchors a
//      commitment to a number she never said.
//
// After the signature passes, every answer is 200 -- including the ones where
// the payload was nonsense. A non-200 makes Meta redeliver the same message
// for hours, and the second delivery of a bad payload is no better than the
// first. What happened is recorded in whatsapp_inbound_events either way.
//
// No phone number is stored anywhere in this path: PLAN.md 2.2 puts phone
// numbers into the PII scan's search set before the first real one is kept,
// and that has not happened yet.
//
// Secrets: WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET; SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import { flowReplies, parseFlowReply, signatureMatches } from "../_shared/whatsapp.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Meta's one-time handshake: echo the challenge, in plain text, only for our own verify token. */
function verification(url: URL): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || token !== env("WHATSAPP_VERIFY_TOKEN") || challenge === null) {
    return new Response("forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

interface Outcome {
  message_id: string;
  status: string;
  detail?: string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") return verification(url);
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // Read once, as text. The signature is over the bytes Meta sent, and
  // JSON.stringify(JSON.parse(x)) is not x.
  const raw = await req.text();
  if (!await signatureMatches(raw, req.headers.get("x-hub-signature-256"), env("WHATSAPP_APP_SECRET"))) {
    return json({ error: "signature" }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ handled: 0, note: "body is not JSON" });
  }

  const replies = flowReplies(body);
  const outcomes: Outcome[] = [];

  for (const reply of replies) {
    let half;
    try {
      half = parseFlowReply(reply.responseJson);
    } catch (error) {
      // She filled it in; something between her keyboard and here is wrong.
      // Recorded, not retried, and never guessed at.
      console.error("unreadable flow reply", reply.messageId, String(error));
      outcomes.push({ message_id: reply.messageId, status: "unreadable", detail: String(error) });
      continue;
    }

    const { data, error } = await db.rpc("whatsapp_record_half", {
      p_message_id: reply.messageId,
      p_token: half.flowToken,
      p_revenue_cents: half.revenueCents,
      p_cogs_cents: half.cogsCents,
      p_opex_cents: half.opexCents,
      p_household_cents: half.householdCents,
      p_keeps_records: half.keepsRecords,
      p_active_days: half.activeDays,
    });

    if (error) {
      console.error("refused", reply.messageId, error.message);
      outcomes.push({ message_id: reply.messageId, status: "refused", detail: error.message });
      continue;
    }
    outcomes.push({ message_id: reply.messageId, status: String((data as { status?: unknown })?.status ?? "recorded") });
  }

  return json({ handled: outcomes.length, outcomes });
});
