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
import {
  canonicalPhone, flowReplies, parseFlowReply, sendTextRequest, signatureMatches, textMessages,
} from "../_shared/whatsapp.ts";
import { advance, CONSENT_TEXT_VERSION, type Conversation } from "../_shared/conversation.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Sends her a message, if this deployment can.
 *
 * Optional on purpose: the receiving half has to keep working before Meta is
 * wired up, so a missing token is a line in the log and a recorded outcome
 * rather than a webhook that starts refusing deliveries.
 */
async function sendText(to: string, body: string): Promise<boolean> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    console.warn("not sending: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set");
    return false;
  }
  const { url, init } = sendTextRequest(phoneNumberId, to, body);
  const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` };
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    console.error("send failed", response.status, await response.text());
    return false;
  }
  return true;
}

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

/**
 * Keeps a promise alive after the response is sent. Supabase's edge runtime,
 * which is where this runs, provides waitUntil for exactly that. Anywhere
 * without it the promise is started but may be cut off when the response
 * ends -- so outside Supabase a reading can be lost, never doubled.
 */
function background(work: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(work);
  else void work;
}

/**
 * Asks checkin-report for the month's reading and sends it to her. A month
 * already read returns the same reading without a second model call, so a
 * retried delivery cannot cost twice -- but it would message her twice, so a
 * repeat is not sent.
 */
async function sendReading(checkinId: string, from: string): Promise<void> {
  try {
    const response = await fetch(`${env("SUPABASE_URL")}/functions/v1/checkin-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ checkin_id: checkinId }),
    });
    const body = await response.json().catch(() => null) as { text?: string; repeated?: boolean } | null;
    if (!response.ok || !body?.text) {
      console.error("no reading for", checkinId, response.status);
      return;
    }
    if (body.repeated) return;
    await sendText(canonicalPhone(from), body.text);
  } catch (e) {
    console.error("reading not delivered", checkinId, String(e));
  }
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
  const texts = textMessages(body);
  const outcomes: Outcome[] = [];

  // The entry conversation. One question at a time, and the row it reads is
  // the only thing that remembers where she was -- which is why a retried
  // delivery has to be recognised before the machine sees it: run twice, an
  // answer advances two questions and lands under the wrong one.
  for (const message of texts) {
    const { data: isNew, error: seenError } = await db.rpc("whatsapp_message_is_new", {
      p_message_id: message.messageId,
    });
    if (seenError) {
      console.error("dedupe failed", message.messageId, seenError.message);
      outcomes.push({ message_id: message.messageId, status: "refused", detail: seenError.message });
      continue;
    }
    if (!isNew) {
      outcomes.push({ message_id: message.messageId, status: "duplicate" });
      continue;
    }

    let phone: string;
    try {
      phone = canonicalPhone(message.from);
    } catch (error) {
      console.error("unreadable sender", message.messageId, String(error));
      outcomes.push({ message_id: message.messageId, status: "unreadable", detail: String(error) });
      continue;
    }

    const { data: row, error: readError } = await db.rpc("whatsapp_conversation_for", { p_e164: phone });
    if (readError) {
      console.error("conversation unavailable", message.messageId, readError.message);
      outcomes.push({ message_id: message.messageId, status: "refused", detail: readError.message });
      continue;
    }

    const conversation = row as Conversation;
    const turn = advance(conversation, message.text);

    // Enrolling first: if it fails she must not be left recorded as ACTIVE
    // with no account behind it, answering a check-in that belongs to nobody.
    if (turn.completed) {
      const { error: enrolError } = await db.rpc("whatsapp_enrol", {
        p_e164: phone,
        p_draft: turn.next.draft,
        p_text_version: CONSENT_TEXT_VERSION,
      });
      if (enrolError) {
        console.error("could not enrol", message.messageId, enrolError.message);
        outcomes.push({ message_id: message.messageId, status: "refused", detail: enrolError.message });
        continue;
      }
    }

    const { error: saveError } = await db.rpc("whatsapp_conversation_save", {
      p_e164: phone,
      p_state: turn.next.state,
      p_step: turn.next.step,
      p_draft: turn.next.draft,
    });
    if (saveError) {
      console.error("could not save the conversation", message.messageId, saveError.message);
      outcomes.push({ message_id: message.messageId, status: "refused", detail: saveError.message });
      continue;
    }

    for (const text of turn.say) await sendText(phone, text);
    outcomes.push({
      message_id: message.messageId,
      status: turn.completed ? "enrolled" : `conversation:${turn.next.state}`,
    });
  }

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
    const recorded = data as { status?: unknown; checkin_id?: unknown };
    outcomes.push({ message_id: reply.messageId, status: String(recorded?.status ?? "recorded") });

    // The month just closed: she gets its reading. In the background, so Meta
    // has its 200 now -- the model takes seconds and Meta does not wait.
    if (recorded?.status === "month_assembled" && typeof recorded.checkin_id === "string" && reply.from) {
      background(sendReading(recorded.checkin_id, reply.from));
    }
  }

  return json({ handled: outcomes.length, outcomes });
});
