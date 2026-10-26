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
  audioMessages, canonicalPhone, flowReplies, GRAPH, sendChoiceRequest, sendTextRequest, signatureMatches, textMessages,
} from "../_shared/whatsapp.ts";
import { advance, CONSENT_TEXT_VERSION, type Conversation, type Say } from "../_shared/conversation.ts";
import {
  addDays, buttonReplies, type ButtonReply, confirmationText, type DaySummary, EMPTY_FORM_TEXT, earnedText, isAuthorise, isDecline,
  isJournalReply, isListText, isSharesText, type JournalLine, listText, type ListedLine, type ListedShare,
  GOAL_AMOUNT_AGAIN_TEXT, GOAL_SKIPPED_TEXT, goalAsk, goalButton, goalDaysChoice, goalMetText, goalProgressLine,
  goalSalesAsk, goalSetText, isGoalText, type LastWeek, lastWeekText, type WeekFigures, type WeekGoal,
  type Milestone, OPEN_FORM, parseJournalReply, type Progress, quietButton, type QuietReason, quietTextReason, refusedText,
  revokeNumber, sendFlowRequest, sentAtOf, SHARE_CONSENT_TEXT_VERSION, shareAnswerText, shareRevokedText,
  sharesText, spDate, voidedText, voidNumber, voidRefusedText, weekToRead,
} from "../_shared/journal.ts";
import {
  DEFAULT_INTERPRET_MODEL, DEFAULT_TRANSCRIBE_MODEL, DISCARDED_TEXT, draftButton, draftMessages, heardText,
  interpretRequest, INTERPRET_PROMPT_VERSION, looksLikeFigures, MAX_AUDIO_BYTES, MAX_DRAFTS_PER_DAY, MAX_TEXT_CHARS,
  NO_VOICE_TEXT, nothingReadText, readInterpretation, sendDraftRequest, spokenCents, STALE_DRAFT_TEXT, TOO_LONG_TEXT,
  TOO_MANY_TEXT, toolInput, transcribeRequest, VOICE_FAILED_TEXT,
} from "../_shared/spoken.ts";

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

/** One message of a turn: plain text, or a question she answers with a tap. */
async function sendSay(to: string, say: Say): Promise<boolean> {
  if (typeof say === "string") return await sendText(to, say);
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    console.warn("not sending: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set");
    return false;
  }
  const { url, init } = sendChoiceRequest(phoneNumberId, to, say);
  const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` };
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    console.error("choice send failed", response.status, await response.text());
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
  await afterRecorded(phone, from, String(entrepreneurId), messageId, day, sentAt);
  return { message_id: messageId, status: `journal:${status}` };
}

/**
 * What follows a day written down, however it came in: the confirmation, the
 * streak and anything it earned, a share waiting to go, and the week's
 * reading when it is due.
 */
async function afterRecorded(
  phone: string,
  from: string,
  entrepreneurId: string,
  messageId: string,
  day: string,
  sentAt: Date,
): Promise<void> {
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

  // The week's goal: its progress, met just now, last week's result, or the question.
  const { data: goalData, error: goalError } = await db.rpc("journal_goal_after_record", {
    p_entrepreneur_id: entrepreneurId,
  });
  if (goalError) console.error("no goal", messageId, goalError.message);
  const g = goalError ? null : goalData as {
    goal: WeekGoal | null;
    just_met: boolean;
    run: number | null;
    last_week: LastWeek | null;
    ask: boolean;
    reference: WeekFigures;
  };

  if (sumError) {
    console.error("no summary", messageId, sumError.message);
  } else {
    await sendText(phone, confirmationText(day, sentAt, summary as DaySummary, p, g?.goal));
  }
  for (const m of p?.earned ?? []) await sendText(phone, earnedText(m));
  if (g?.just_met && g.goal) await sendText(phone, goalMetText(g.goal, g.run ?? 1));
  if (g?.last_week) await sendText(phone, lastWeekText(g.last_week));
  if (g?.ask) await sendSay(phone, goalAsk(g.reference));
  await deliverShare(phone, entrepreneurId);

  // The week this day may close: read it, after the confirmation, if it is
  // due -- ended, kept at least three days, and not read yet.
  const week = weekToRead(day);
  const { data: due, error: dueError } = await db.rpc("journal_reading_due", {
    p_entrepreneur_id: entrepreneurId,
    p_week_start: week,
  });
  if (dueError) console.error("could not check the week", messageId, dueError.message);
  else if (due) background(sendReading({ entrepreneur_id: entrepreneurId, week_start: week }, from));
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

// ------------------------------------------------------- in her own words

/** The Graph API, with the token; null when this deployment cannot reach it. */
function graph(): { token: string; phoneNumberId: string } | null {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

/** The draft, with its Confirmar and Corrigir buttons; the formatted list first when it is long. */
async function sendDraft(to: string, before: string | null, body: string, draftId: string): Promise<boolean> {
  const g = graph();
  if (!g) {
    console.warn("not sending the draft: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set");
    return false;
  }
  if (before !== null && !(await sendText(to, before))) return false;
  const { url, init } = sendDraftRequest(g.phoneNumberId, to, body, draftId);
  const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${g.token}` };
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    console.error("draft send failed", response.status, await response.text());
    return false;
  }
  return true;
}

/**
 * The voice note's bytes, from Meta, held in memory only: they are handed to
 * the transcriber and never written anywhere. Null when it is too large.
 */
async function fetchAudio(mediaId: string): Promise<{ audio: Blob; mimeType: string } | null> {
  const g = graph();
  if (!g) throw new Error("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set");
  const auth = { Authorization: `Bearer ${g.token}` };
  const metaResponse = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
    headers: auth,
    signal: AbortSignal.timeout(10_000),
  });
  if (!metaResponse.ok) throw new Error(`media lookup answered ${metaResponse.status}`);
  const media = await metaResponse.json() as { url?: unknown; mime_type?: unknown; file_size?: unknown };
  if (typeof media.url !== "string") throw new Error("media lookup returned no url");
  if (Number(media.file_size) > MAX_AUDIO_BYTES) return null;
  const fileResponse = await fetch(media.url, { headers: auth, signal: AbortSignal.timeout(20_000) });
  if (!fileResponse.ok) throw new Error(`media download answered ${fileResponse.status}`);
  const audio = await fileResponse.blob();
  if (audio.size > MAX_AUDIO_BYTES) return null;
  return { audio, mimeType: typeof media.mime_type === "string" ? media.mime_type : audio.type };
}

const EXTENSION: Record<string, string> = { ogg: "ogg", opus: "ogg", mpeg: "mp3", mp3: "mp3", mp4: "m4a", aac: "m4a", wav: "wav", webm: "webm" };
const filenameFor = (mimeType: string) =>
  `voz.${EXTENSION[mimeType.split(";")[0].split("/")[1]?.trim() ?? ""] ?? "ogg"}`;

/**
 * Reads what she said as a day, checks it, and sends her the draft to confirm
 * -- or tells her what was missing and offers the form. Runs in the
 * background, after Meta has its 200.
 */
async function propose(
  phone: string,
  entrepreneurId: string,
  messageId: string,
  source: "voice" | "text",
  said: string,
  sentAt: Date,
  transcriber: string | null,
): Promise<void> {
  const apiKey = env("ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANTHROPIC_INTERPRET_MODEL") || DEFAULT_INTERPRET_MODEL;
  const { url, init } = interpretRequest(apiKey, model, said);
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`model answered ${response.status}`);
  const input = toolInput(body);
  if (input === null) throw new Error("model returned no reading");

  const reading = readInterpretation(input, said, sentAt);
  // Counts only: the refusals quote her words, and her words stay out of the log.
  if (reading.refusals.length) console.warn("spoken: refused", reading.refusals.length, "parts", messageId);

  if (reading.lines.length === 0) {
    await sendText(phone, nothingReadText(reading));
    await sendJournalForm(phone);
    return;
  }
  const { data: draftId, error } = await db.rpc("journal_draft_create", {
    p_entrepreneur_id: entrepreneurId,
    p_message_id: messageId,
    p_source: source,
    p_transcript: said,
    p_day: reading.day,
    p_lines: reading.lines,
    p_model: model,
    p_prompt_version: INTERPRET_PROMPT_VERSION,
    p_transcriber: transcriber,
    p_refusals: reading.refusals,
  });
  if (error) throw new Error(`draft not kept: ${error.message}`);
  const { before, body: text } = draftMessages(reading, sentAt);
  await sendDraft(phone, before, text, String(draftId));
}

/** Whether she may send one more message to the services today. Counted if so. */
async function mayUseServices(phone: string, entrepreneurId: string): Promise<boolean> {
  const { data: allowed, error } = await db.rpc("journal_spoken_allow", {
    p_entrepreneur_id: entrepreneurId,
    p_limit: MAX_DRAFTS_PER_DAY,
  });
  if (error) throw new Error(`limit unavailable: ${error.message}`);
  if (allowed) return true;
  await sendText(phone, TOO_MANY_TEXT);
  await sendJournalForm(phone);
  return false;
}

/** A message she wrote, read as a day. */
async function proposeFromText(phone: string, entrepreneurId: string, messageId: string, text: string): Promise<void> {
  try {
    if (!(await mayUseServices(phone, entrepreneurId))) return;
    await propose(phone, entrepreneurId, messageId, "text", text, new Date(), null);
  } catch (e) {
    console.error("spoken text failed", messageId, String(e));
    await sendText(phone, "Não consegui ler essa mensagem agora. Pode tentar de novo daqui a pouco, ou usar o formulário? 💜");
    await sendJournalForm(phone);
  }
}

/** A voice note, transcribed and read as a day. */
async function proposeFromVoice(
  phone: string,
  entrepreneurId: string,
  messageId: string,
  mediaId: string,
  sentAt: Date,
): Promise<void> {
  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey || !Deno.env.get("ANTHROPIC_API_KEY")) {
      await sendText(phone, NO_VOICE_TEXT);
      await sendJournalForm(phone);
      return;
    }
    if (!(await mayUseServices(phone, entrepreneurId))) return;
    const fetched = await fetchAudio(mediaId);
    if (fetched === null) {
      await sendText(phone, TOO_LONG_TEXT);
      return;
    }
    const transcriber = Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || DEFAULT_TRANSCRIBE_MODEL;
    const { url, init } = transcribeRequest(openAiKey, transcriber, fetched.audio, filenameFor(fetched.mimeType));
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    const body = await response.json().catch(() => null) as { text?: unknown } | null;
    if (!response.ok) throw new Error(`transcriber answered ${response.status}`);
    const said = typeof body?.text === "string" ? body.text.trim() : "";
    if (said === "") {
      await sendText(phone, VOICE_FAILED_TEXT);
      return;
    }
    await sendText(phone, heardText(said));
    await propose(phone, entrepreneurId, messageId, "voice", said.slice(0, 5_000), sentAt, transcriber);
  } catch (e) {
    console.error("spoken voice failed", messageId, String(e));
    await sendText(phone, VOICE_FAILED_TEXT);
    await sendJournalForm(phone);
  }
}

/**
 * Confirmar or Corrigir, tapped on a draft. Confirmed, the day is written
 * exactly as the draft showed it; corrected, nothing is written.
 */
async function decideDraft(button: ButtonReply, draft: { id: string; confirm: boolean }): Promise<Outcome> {
  const { data: isNew, error: seenError } = await db.rpc("whatsapp_message_is_new", { p_message_id: button.messageId });
  if (seenError) return { message_id: button.messageId, status: "refused", detail: seenError.message };
  if (!isNew) return { message_id: button.messageId, status: "duplicate" };
  let phone: string;
  try {
    phone = canonicalPhone(button.from);
  } catch (error) {
    return { message_id: button.messageId, status: "unreadable", detail: String(error) };
  }
  const { data: who, error: whoError } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
  if (whoError || !who) {
    return { message_id: button.messageId, status: "refused", detail: whoError?.message ?? "not enrolled" };
  }
  const { data, error } = await db.rpc("journal_draft_decide", {
    p_draft_id: draft.id,
    p_entrepreneur_id: who,
    p_confirm: draft.confirm,
  });
  if (error) {
    console.error("draft refused", button.messageId, error.message);
    await sendText(phone, refusedText(inHerWords(error.message)));
    return { message_id: button.messageId, status: "refused", detail: error.message };
  }
  const d = data as { status: string; day?: string; recorded?: { status?: string } };
  if (d.status === "stale") {
    await sendText(phone, STALE_DRAFT_TEXT);
    return { message_id: button.messageId, status: "draft:stale" };
  }
  if (d.status === "discarded") {
    await sendText(phone, DISCARDED_TEXT);
    await sendJournalForm(phone);
    return { message_id: button.messageId, status: "draft:discarded" };
  }
  const recorded = String(d.recorded?.status ?? "recorded");
  if (recorded !== "duplicate" && d.day) {
    await afterRecorded(phone, button.from, String(who), button.messageId, d.day, button.sentAt);
  }
  return { message_id: button.messageId, status: `draft:confirmed:${recorded}` };
}

/**
 * One turn of the entry conversation: her answer, typed or tapped, through the
 * machine; the enrolment when it completes; the row saved; the reply sent.
 */
async function takeTurn(phone: string, messageId: string, conversation: Conversation, incoming: string): Promise<Outcome> {
  const turn = advance(conversation, incoming);

  // Enrolling first: if it fails she must not be left recorded as ACTIVE
  // with no account behind it, answering a check-in that belongs to nobody.
  if (turn.completed) {
    const { error: enrolError } = await db.rpc("whatsapp_enrol", {
      p_e164: phone,
      p_draft: turn.next.draft,
      p_text_version: CONSENT_TEXT_VERSION,
    });
    if (enrolError) {
      console.error("could not enrol", messageId, enrolError.message);
      return { message_id: messageId, status: "refused", detail: enrolError.message };
    }
  }

  const { error: saveError } = await db.rpc("whatsapp_conversation_save", {
    p_e164: phone,
    p_state: turn.next.state,
    p_step: turn.next.step,
    p_draft: turn.next.draft,
  });
  if (saveError) {
    console.error("could not save the conversation", messageId, saveError.message);
    return { message_id: messageId, status: "refused", detail: saveError.message };
  }

  for (const say of turn.say) await sendSay(phone, say);
  if (turn.offerJournal) await sendJournalForm(phone);
  return { message_id: messageId, status: turn.completed ? "enrolled" : `conversation:${turn.next.state}` };
}

/** META, written: this week's goal and how it is going, or the question again. */
async function goalNow(phone: string, entrepreneurId: string): Promise<void> {
  const { data, error } = await db.rpc("journal_goal_now", { p_entrepreneur_id: entrepreneurId });
  if (error) throw new Error(error.message);
  const now = data as { goal: WeekGoal | null; reference?: WeekFigures };
  if (now.goal) await sendText(phone, goalProgressLine(now.goal));
  else await sendSay(phone, goalAsk(now.reference));
}

/** A tap on the goal question, or on how many days. */
async function goalTapped(
  phone: string,
  entrepreneurId: string,
  tap: { choice: "days" | "sales" | "skip"; days?: number },
): Promise<string> {
  // Days, but not how many yet: the list of what is still reachable this week.
  if (tap.choice === "days" && tap.days === undefined) {
    const { data, error } = await db.rpc("journal_goal_now", { p_entrepreneur_id: entrepreneurId });
    if (error) throw new Error(error.message);
    const now = data as { goal: WeekGoal | null; reference?: WeekFigures; max_days?: number };
    if (now.goal) {
      await sendText(phone, goalProgressLine(now.goal));
      return "goal:already_set";
    }
    await sendSay(phone, goalDaysChoice(now.max_days ?? 0, now.reference));
    return "goal:days_asked";
  }
  const choice = tap.choice === "skip" ? "skip" : tap.choice === "sales" ? "sales_pending" : "days";
  const { data, error } = await db.rpc("journal_goal_answer", {
    p_entrepreneur_id: entrepreneurId,
    p_choice: choice,
    p_target: tap.days ?? null,
  });
  if (error) throw new Error(error.message);
  const r = data as { status: string; kind?: "days" | "sales"; target?: number; figures?: WeekFigures };
  if (r.status === "already_set" && r.kind && r.target) {
    await sendText(phone, `Você já tem uma meta nesta semana. ${goalSetText(r.kind, r.target, r.figures ?? { days_kept: 0, sales_cents: 0 })}`);
  } else if (r.status === "skipped") {
    await sendText(phone, GOAL_SKIPPED_TEXT);
  } else if (r.status === "sales_pending") {
    const { data: now } = await db.rpc("journal_goal_now", { p_entrepreneur_id: entrepreneurId });
    await sendText(phone, goalSalesAsk((now as { reference?: WeekFigures } | null)?.reference));
  } else if (r.kind && r.target && r.figures) {
    await sendText(phone, goalSetText(r.kind, r.target, r.figures));
  }
  return `goal:${r.status}`;
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
  const audios = audioMessages(body);
  const outcomes: Outcome[] = [];

  // Anything she sends counts as being here: a paused reminder resumes. One
  // stamp per sender per delivery; a failure here costs nothing she sent.
  const senders = new Set<string>();
  for (const m of [...texts, ...audios, ...buttons]) senders.add(m.from);
  for (const r of replies) if (r.from) senders.add(r.from);
  for (const from of senders) {
    try {
      const { error } = await db.rpc("whatsapp_heard", { p_e164: canonicalPhone(from) });
      if (error) console.error("not stamped", error.message);
    } catch {
      // An unreadable number is dealt with where its message is handled.
    }
  }

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

    // META, and the sales amount she was just asked for -- before the spoken
    // path, which would otherwise read "1500" as a day.
    if (conversation.state === "ACTIVE") {
      const { data: who } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
      if (who && isGoalText(message.text)) {
        try {
          await goalNow(phone, String(who));
          outcomes.push({ message_id: message.messageId, status: "goal:shown" });
        } catch (error) {
          outcomes.push({ message_id: message.messageId, status: "refused", detail: String(error) });
        }
        continue;
      }
      const { data: awaiting } = who
        ? await db.rpc("journal_goal_awaiting_amount", { p_entrepreneur_id: who })
        : { data: false };
      if (who && awaiting && looksLikeFigures(message.text)) {
        let cents: number | null = null;
        try {
          cents = spokenCents(message.text);
        } catch {
          cents = null;
        }
        if (cents === null || cents < 100) {
          await sendText(phone, GOAL_AMOUNT_AGAIN_TEXT);
          outcomes.push({ message_id: message.messageId, status: "goal:amount_unreadable" });
          continue;
        }
        const { data: set, error: setError } = await db.rpc("journal_goal_answer", {
          p_entrepreneur_id: who,
          p_choice: "sales",
          p_target: cents,
        });
        if (setError) {
          outcomes.push({ message_id: message.messageId, status: "refused", detail: setError.message });
          continue;
        }
        const r = set as { status: string; kind?: "days" | "sales"; target?: number; figures?: WeekFigures };
        if (r.kind && r.target && r.figures) await sendText(phone, goalSetText(r.kind, r.target, r.figures));
        outcomes.push({ message_id: message.messageId, status: `goal:${r.status}` });
        continue;
      }
    }

    // Her day in her own words: a message with a figure in it is read by the
    // model, checked by code, and written only when she confirms the draft.
    if (
      conversation.state === "ACTIVE" && looksLikeFigures(message.text) && message.text.length <= MAX_TEXT_CHARS &&
      Deno.env.get("ANTHROPIC_API_KEY")
    ) {
      const { data: who } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
      if (who) {
        background(proposeFromText(phone, String(who), message.messageId, message.text));
        outcomes.push({ message_id: message.messageId, status: "spoken:text" });
        continue;
      }
    }

    outcomes.push(await takeTurn(phone, message.messageId, conversation, message.text));
  }

  // A voice note: transcribed, read and checked in the background, and sent
  // back to her as a draft to confirm.
  for (const audio of audios) {
    const { data: isNew, error: seenError } = await db.rpc("whatsapp_message_is_new", { p_message_id: audio.messageId });
    if (seenError || !isNew) {
      outcomes.push({ message_id: audio.messageId, status: seenError ? "refused" : "duplicate", detail: seenError?.message });
      continue;
    }
    let phone: string;
    try {
      phone = canonicalPhone(audio.from);
    } catch (error) {
      outcomes.push({ message_id: audio.messageId, status: "unreadable", detail: String(error) });
      continue;
    }
    const { data: row } = await db.rpc("whatsapp_conversation_for", { p_e164: phone });
    const state = (row as Conversation | null)?.state ?? "NEW";
    const { data: who } = state === "ACTIVE" ? await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone }) : { data: null };
    if (!who) {
      if (state !== "OPTED_OUT") {
        await sendText(phone, state === "NEW"
          ? "Oi! Para começar, escreva OI. 💜"
          : "Para terminar o seu cadastro, me responda por escrito, por favor. 💜");
      }
      outcomes.push({ message_id: audio.messageId, status: "spoken:not_enrolled" });
      continue;
    }
    background(proposeFromVoice(phone, String(who), audio.messageId, audio.mediaId, sentAtOf(audio.timestamp)));
    outcomes.push({ message_id: audio.messageId, status: "spoken:voice" });
  }

  // "Não abri ontem" / "Abri e não vendi", tapped on the nine o'clock reminder.
  for (const button of buttons) {
    const draft = draftButton(button.payload);
    if (draft !== undefined) {
      outcomes.push(await decideDraft(button, draft));
      continue;
    }
    // A tap on a sign-up question: the same turn as a typed answer.
    if (button.payload.startsWith("onb:")) {
      const { data: isNew } = await db.rpc("whatsapp_message_is_new", { p_message_id: button.messageId });
      if (!isNew) {
        outcomes.push({ message_id: button.messageId, status: "duplicate" });
        continue;
      }
      try {
        const phone = canonicalPhone(button.from);
        const { data: row, error: readError } = await db.rpc("whatsapp_conversation_for", { p_e164: phone });
        if (readError) throw new Error(readError.message);
        outcomes.push(await takeTurn(phone, button.messageId, row as Conversation, button.payload));
      } catch (error) {
        outcomes.push({ message_id: button.messageId, status: "refused", detail: String(error) });
      }
      continue;
    }

    // A tap on the weekly goal question.
    const goal = goalButton(button.payload);
    if (goal !== undefined) {
      const { data: isNew } = await db.rpc("whatsapp_message_is_new", { p_message_id: button.messageId });
      if (!isNew) {
        outcomes.push({ message_id: button.messageId, status: "duplicate" });
        continue;
      }
      try {
        const phone = canonicalPhone(button.from);
        const { data: who } = await db.rpc("whatsapp_entrepreneur_for", { p_e164: phone });
        if (!who) throw new Error("not enrolled");
        outcomes.push({ message_id: button.messageId, status: await goalTapped(phone, String(who), goal) });
      } catch (error) {
        outcomes.push({ message_id: button.messageId, status: "refused", detail: String(error) });
      }
      continue;
    }

    // "Registrar ontem", on the reminder: the form, inside the window her tap opened.
    if (button.payload === OPEN_FORM) {
      const { data: isNew } = await db.rpc("whatsapp_message_is_new", { p_message_id: button.messageId });
      if (isNew) {
        try {
          await sendJournalForm(canonicalPhone(button.from));
        } catch (error) {
          outcomes.push({ message_id: button.messageId, status: "unreadable", detail: String(error) });
          continue;
        }
      }
      outcomes.push({ message_id: button.messageId, status: isNew ? "journal:form_sent" : "duplicate" });
      continue;
    }
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
