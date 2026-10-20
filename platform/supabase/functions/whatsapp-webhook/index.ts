// whatsapp-webhook — where what she writes on her phone becomes a row.
//
// Meta delivers here: the verification handshake it does once when the URL
// is registered, and POSTs carrying her text messages, her button answers and
// the daily form (the journal) when she completes it.
//
// Before anything is written:
//
//   1. The signature. X-Hub-Signature-256 over the raw bytes, HMAC with the
//      app secret. Without it the URL is a public write to a woman's revenue.
//   2. The figures. "1.234,56" is pt-BR; "1,234.56" is refused rather than
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
// Secrets: WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET; to answer her,
// WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_JOURNAL_FLOW_ID
// for the daily form; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
// runtime.

import { createClient } from "@supabase/supabase-js";
import {
  canonicalPhone, flowReplies, sendTextRequest, signatureMatches, textMessages,
} from "../_shared/whatsapp.ts";
import { advance, CONSENT_TEXT_VERSION, type Conversation } from "../_shared/conversation.ts";
import {
  addDays, buttonReplies, confirmationText, type DaySummary, EMPTY_FORM_TEXT, earnedText, isAuthorise, isDecline,
  isJournalReply, isListText, isSharesText, type JournalLine, listText, type ListedLine, type ListedShare,
  type Milestone, parseJournalReply, type Progress, quietButton, type QuietReason, quietTextReason, refusedText,
  revokeNumber, sendFlowRequest, sentAtOf, SHARE_CONSENT_TEXT_VERSION, shareAnswerText, shareRevokedText,
  sharesText, spDate, voidedText, voidNumber, voidRefusedText, weekToRead,
} from "../_shared/journal.ts";

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

/**
 * Opens the daily form for her, if this deployment knows the form's id.
 * Like sendText, a missing setting is a line in the log, not a refusal.
 */
async function sendJournalForm(to: string): Promise<boolean> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const flowId = Deno.env.get("WHATSAPP_JOURNAL_FLOW_ID");
  if (!token || !phoneNumberId || !flowId) {
    console.warn("not sending the form: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_JOURNAL_FLOW_ID not set");
    return false;
  }
  const { url, init } = sendFlowRequest(phoneNumberId, to, flowId, "Registro do dia 📒");
  const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` };
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    console.error("form send failed", response.status, await response.text());
    return false;
  }
  return true;
}

/** The database's refusals, in words she can act on. */
function inHerWords(message: string): string {
  if (message.includes("on the day or the day after")) return "só dá para registrar o dia de hoje ou o de ontem";
  if (message.includes("already has lines")) return "esse dia já tem vendas ou gastos registrados";
  return "algum valor do formulário não está certo";
}

/**
 * Writes one message's worth of a day and tells her what is now recorded.
 * Returns the outcome for the delivery log.
 */
async function recordDay(
  from: string,
  messageId: string,
  day: string,
  sentAt: Date,
  lines: JournalLine[] | "quiet",
  quietReason: QuietReason = null,
): Promise<Outcome> {
  let phone: string;
  try {
    phone = canonicalPhone(from);
  } catch (error) {
    return { message_id: messageId, status: "unreadable", detail: String(error) };
  }
  const { data: entrepreneurId, error: whoError } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
  if (whoError) return { message_id: messageId, status: "refused", detail: whoError.message };
  if (!entrepreneurId) {
    await sendText(phone, "Ainda não encontrei o seu cadastro. Escreva OI para começar. 💜");
    return { message_id: messageId, status: "unknown_sender" };
  }

  const { data, error } = await db.rpc("journal_record", {
    p_entrepreneur_id: entrepreneurId,
    p_message_id: messageId,
    p_day: day,
    p_entries: lines === "quiet" ? [] : lines,
    p_no_activity: lines === "quiet",
    p_quiet_reason: lines === "quiet" ? quietReason : null,
  });
  if (error) {
    console.error("journal refused", messageId, error.message);
    await sendText(phone, refusedText(inHerWords(error.message)));
    return { message_id: messageId, status: "refused", detail: error.message };
  }
  const status = String((data as { status?: unknown })?.status ?? "recorded");
  if (status === "duplicate") return { message_id: messageId, status };

  const { data: summary, error: sumError } = await db.rpc("journal_day_summary", {
    p_entrepreneur_id: entrepreneurId,
    p_day: day,
  });
  // The streak, and whatever it has just earned. A failure here costs her the
  // progress line, never the day she recorded: that is already written.
  const { data: progress, error: progError } = await db.rpc("journal_progress", {
    p_entrepreneur_id: entrepreneurId,
    p_day: day,
  });
  if (progError) console.error("no progress", messageId, progError.message);
  const p = progError ? null : progress as Progress;

  if (sumError) {
    console.error("no summary", messageId, sumError.message);
  } else {
    await sendText(phone, confirmationText(day, sentAt, summary as DaySummary, p));
  }
  for (const m of p?.earned ?? []) await sendText(phone, earnedText(m));
  await deliverShare(phone, String(entrepreneurId));

  // The week this day may close: read it, after the confirmation, if it is
  // due -- ended, kept at least three days, and not read yet.
  const week = weekToRead(day);
  const { data: due, error: dueError } = await db.rpc("journal_reading_due", {
    p_entrepreneur_id: entrepreneurId,
    p_week_start: week,
  });
  if (dueError) console.error("could not check the week", messageId, dueError.message);
  else if (due) background(sendReading({ entrepreneur_id: String(entrepreneurId), week_start: week }, from));

  return { message_id: messageId, status: `journal:${status}` };
}

/**
 * A share proposed to her and not yet sent -- by the benefit she has just
 * earned, or by staff -- goes now, inside the window she just opened. Her
 * seven days to answer start only once it has actually been sent.
 */
async function deliverShare(phone: string, entrepreneurId: string): Promise<void> {
  const { data, error } = await db.rpc("share_to_deliver", { p_entrepreneur_id: entrepreneurId });
  if (error) {
    console.error("could not read the share to deliver", error.message);
    return;
  }
  const share = data as { id: string; text: string } | null;
  if (!share) return;
  if (!(await sendText(phone, share.text))) return;
  const { error: markError } = await db.rpc("share_delivered", { p_share_id: share.id });
  if (markError) console.error("share sent but not marked", share.id, markError.message);
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
 * Asks checkin-report for a reading -- a month's, { checkin_id }, or a week's,
 * { entrepreneur_id, week_start } -- and sends it to her. A period already
 * read returns the same reading without a second model call, so a retried
 * delivery cannot cost twice -- but it would message her twice, so a repeat
 * is not sent.
 */
async function sendReading(period: Record<string, string>, from: string): Promise<void> {
  const label = Object.values(period).join(" ");
  try {
    const response = await fetch(`${env("SUPABASE_URL")}/functions/v1/checkin-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify(period),
    });
    const body = await response.json().catch(() => null) as { text?: string; repeated?: boolean } | null;
    if (!response.ok || !body?.text) {
      console.error("no reading for", label, response.status);
      return;
    }
    if (body.repeated) return;
    await sendText(canonicalPhone(from), body.text);
  } catch (e) {
    console.error("reading not delivered", label, String(e));
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
  const buttons = buttonReplies(body);
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

    // Enrolled, and telling us yesterday was quiet in words rather than with
    // the button. Its own id: this message is already marked as seen above,
    // and journal_record recognises retries by id too.
    const quiet = conversation.state === "ACTIVE" ? quietTextReason(message.text) : undefined;
    if (quiet !== undefined) {
      const now = new Date();
      outcomes.push(await recordDay(message.from, `${message.messageId}:quiet`, addDays(spDate(now), -1), now, "quiet", quiet));
      continue;
    }

    // VER: today's and yesterday's lines, numbered. APAGAR n: void one of them.
    const toVoid = conversation.state === "ACTIVE" ? voidNumber(message.text) : null;
    if (conversation.state === "ACTIVE" && (isListText(message.text) || toVoid !== null)) {
      const { data: who, error: whoError } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
      if (whoError || !who) {
        outcomes.push({ message_id: message.messageId, status: "refused", detail: whoError?.message ?? "not enrolled" });
        continue;
      }
      if (toVoid === null) {
        const { data: lines, error: listError } = await db.rpc("journal_list", { p_entrepreneur_id: who });
        if (listError) {
          console.error("could not list", message.messageId, listError.message);
          outcomes.push({ message_id: message.messageId, status: "refused", detail: listError.message });
          continue;
        }
        await sendText(phone, listText(lines as ListedLine[], spDate(new Date())));
        outcomes.push({ message_id: message.messageId, status: "journal:listed" });
      } else {
        const { data: voided, error: voidError } = await db.rpc("journal_void", {
          p_entrepreneur_id: who,
          p_n: toVoid,
          p_message_id: message.messageId,
        });
        if (voidError) {
          await sendText(phone, voidRefusedText(voidError.message));
          outcomes.push({ message_id: message.messageId, status: "refused", detail: voidError.message });
          continue;
        }
        const v = voided as ListedLine & { status: string };
        await sendText(phone, v.status === "already_voided" ? "Esse registro já estava apagado. 💜" : voidedText(v));
        outcomes.push({ message_id: message.messageId, status: `journal:${v.status}` });
      }
      continue;
    }

    // AUTORIZO or NÃO, answering the share she was shown. Anything else --
    // including either word with nothing waiting -- goes to the machine.
    if (conversation.state === "ACTIVE" && (isAuthorise(message.text) || isDecline(message.text))) {
      const { data: who } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
      const { data: open } = who ? await db.rpc("share_open", { p_entrepreneur_id: who }) : { data: false };
      if (who && open) {
        const { data: answered, error: answerError } = await db.rpc("whatsapp_share_answer", {
          p_entrepreneur_id: who,
          p_authorise: isAuthorise(message.text),
          p_message_id: message.messageId,
          p_text_version: SHARE_CONSENT_TEXT_VERSION,
        });
        if (answerError) {
          console.error("share answer failed", message.messageId, answerError.message);
          outcomes.push({ message_id: message.messageId, status: "refused", detail: answerError.message });
          continue;
        }
        const a = answered as { status: string; recipient?: string; expires_on?: string; released?: Milestone[] };
        await sendText(phone, shareAnswerText(a));
        for (const m of a.released ?? []) await sendText(phone, earnedText(m));
        outcomes.push({ message_id: message.messageId, status: `share:${a.status}` });
        continue;
      }
    }

    // AUTORIZAÇÕES: who sees her figures now. ENCERRAR n: end one of them.
    const toRevoke = conversation.state === "ACTIVE" ? revokeNumber(message.text) : null;
    if (conversation.state === "ACTIVE" && (isSharesText(message.text) || toRevoke !== null)) {
      const { data: who, error: whoError } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
      if (whoError || !who) {
        outcomes.push({ message_id: message.messageId, status: "refused", detail: whoError?.message ?? "not enrolled" });
        continue;
      }
      if (toRevoke === null) {
        const { data: shares, error: listError } = await db.rpc("whatsapp_share_list", { p_entrepreneur_id: who });
        if (listError) {
          console.error("could not list shares", message.messageId, listError.message);
          outcomes.push({ message_id: message.messageId, status: "refused", detail: listError.message });
          continue;
        }
        await sendText(phone, sharesText(shares as ListedShare[]));
        outcomes.push({ message_id: message.messageId, status: "share:listed" });
      } else {
        const { data: revoked, error: revokeError } = await db.rpc("whatsapp_share_revoke", {
          p_entrepreneur_id: who,
          p_n: toRevoke,
          p_message_id: message.messageId,
        });
        if (revokeError) {
          console.error("could not revoke", message.messageId, revokeError.message);
          outcomes.push({ message_id: message.messageId, status: "refused", detail: revokeError.message });
          continue;
        }
        const r = revoked as { status: string; recipient?: string };
        await sendText(phone, shareRevokedText(r));
        outcomes.push({ message_id: message.messageId, status: `share:${r.status}` });
      }
      continue;
    }

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
    if (turn.offerJournal) await sendJournalForm(phone);
    outcomes.push({
      message_id: message.messageId,
      status: turn.completed ? "enrolled" : `conversation:${turn.next.state}`,
    });
  }

  // "Não abri ontem" / "Abri e não vendi", tapped on the nine o'clock reminder.
  for (const button of buttons) {
    const reason = quietButton(button.payload);
    if (reason === undefined) {
      outcomes.push({ message_id: button.messageId, status: "ignored", detail: button.payload });
      continue;
    }
    try {
      outcomes.push(
        await recordDay(button.from, button.messageId, addDays(spDate(button.sentAt), -1), button.sentAt, "quiet", reason),
      );
    } catch (error) {
      outcomes.push({ message_id: button.messageId, status: "unreadable", detail: String(error) });
    }
  }

  for (const reply of replies) {
    // The daily form is the only Flow there is; another one is not read.
    if (!isJournalReply(reply.responseJson)) {
      outcomes.push({ message_id: reply.messageId, status: "unreadable", detail: "not the daily form" });
      continue;
    }
    if (!reply.from) {
      outcomes.push({ message_id: reply.messageId, status: "unreadable", detail: "no sender" });
      continue;
    }
    const sentAt = sentAtOf(reply.timestamp);
    let parsed;
    try {
      parsed = parseJournalReply(reply.responseJson, sentAt);
    } catch (error) {
      // The parser's reasons are written in Portuguese, for her.
      console.error("unreadable daily form", reply.messageId, String(error));
      const reason = error instanceof Error ? error.message : String(error);
      const { data: isNew } = await db.rpc("whatsapp_message_is_new", { p_message_id: reply.messageId });
      if (isNew) await sendText(canonicalPhone(reply.from), refusedText(reason));
      outcomes.push({ message_id: reply.messageId, status: "unreadable", detail: reason });
      continue;
    }
    if (parsed.lines.length === 0) {
      const { data: isNew } = await db.rpc("whatsapp_message_is_new", { p_message_id: reply.messageId });
      if (isNew) await sendText(canonicalPhone(reply.from), EMPTY_FORM_TEXT);
      outcomes.push({ message_id: reply.messageId, status: "empty_form" });
      continue;
    }
    outcomes.push(await recordDay(reply.from, reply.messageId, parsed.day, sentAt, parsed.lines));
  }

  return json({ handled: outcomes.length, outcomes });
});
