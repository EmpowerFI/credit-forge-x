// diary-speak-seeker — the Seeker app's voice (PLAN_SEEKER.md §2.2, F4): her
// day said aloud, read into a draft she confirms or discards.
//
// A copy of diary-speak, which the web diary keeps as it is. Two differences:
// ElevenLabs Scribe hears the voice note (batch, in the app's language,
// pt or en), and only the e-mails in SEEKER_VOICE_ALLOW may use it during the
// hackathon (founder, 18/11/2026). The reading, the figure checks and the
// draft are the same shared code (_shared/spoken.ts), so a sale is read the
// same way on both. The audio is held in memory only, never stored.
//
// Secrets: ELEVENLABS_API_KEY (Scribe), ANTHROPIC_API_KEY (reading),
// SEEKER_VOICE_ALLOW (e-mails, comma-separated); optional ELEVENLABS_STT_MODEL,
// ANTHROPIC_INTERPRET_MODEL; SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_INTERPRET_MODEL, INTERPRET_PROMPT_VERSION, interpretRequest, MAX_AUDIO_BYTES,
  MAX_DRAFTS_PER_DAY, MAX_TEXT_CHARS, readInterpretation, toolInput,
} from "../_shared/spoken.ts";
import {
  DEFAULT_STT_MODEL, readScribe, scribeRequest, voiceAllowed, voiceLang,
} from "../_shared/elevenlabs.ts";
import { addDays, spDate } from "../_shared/journal.ts";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function filenameFor(mimeType: string): string {
  if (mimeType.includes("webm")) return "voice.webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) return "voice.m4a";
  if (mimeType.includes("mpeg")) return "voice.mp3";
  if (mimeType.includes("wav")) return "voice.wav";
  return "voice.ogg";
}

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
  if (!voiceAllowed(who.user.email, Deno.env.get("SEEKER_VOICE_ALLOW"))) return json({ error: "voice_not_allowed" }, 403);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: me } = await db.from("entrepreneurs").select("id").eq("profile_id", who.user.id).maybeSingle();
  if (!me) return json({ error: "not_enrolled" }, 403);

  // What she sent: a voice note or her words, the day she chose, and an id
  // that makes a retried request the same draft.
  let audio: File | null = null;
  let text = "";
  let chosenDay = "";
  let requestId = "";
  let lang = voiceLang(undefined);
  const type = req.headers.get("Content-Type") ?? "";
  try {
    if (type.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      audio = file instanceof File ? file : null;
      chosenDay = String(form.get("day") ?? "");
      requestId = String(form.get("request_id") ?? "");
      lang = voiceLang(form.get("lang"));
    } else {
      const body = await req.json() as { text?: unknown; day?: unknown; request_id?: unknown; lang?: unknown };
      lang = voiceLang(body.lang);
      text = typeof body.text === "string" ? body.text.trim() : "";
      chosenDay = typeof body.day === "string" ? body.day : "";
      requestId = typeof body.request_id === "string" ? body.request_id : "";
    }
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const now = new Date();
  const today = spDate(now);
  if (![today, addDays(today, -1)].includes(chosenDay)) return json({ error: "bad_day" }, 400);
  if (!UUID.test(requestId)) return json({ error: "bad_request" }, 400);
  if (!audio && text === "") return json({ error: "nothing_said" }, 400);
  if (text.length > MAX_TEXT_CHARS) return json({ error: "too_long" }, 413);
  if (audio && audio.size > MAX_AUDIO_BYTES) return json({ error: "too_long" }, 413);

  const { data: allowed, error: allowError } = await db.rpc("journal_spoken_allow", {
    p_entrepreneur_id: me.id,
    p_limit: MAX_DRAFTS_PER_DAY,
  });
  if (allowError) return json({ error: "unavailable" }, 503);
  if (!allowed) return json({ error: "too_many_today" }, 429);

  try {
    let said = text;
    let transcriber: string | null = null;
    if (audio) {
      const sttModel = Deno.env.get("ELEVENLABS_STT_MODEL") || DEFAULT_STT_MODEL;
      transcriber = `elevenlabs:${sttModel}`;
      const { url, init } = scribeRequest(env("ELEVENLABS_API_KEY"), sttModel, audio, filenameFor(audio.type), lang);
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`scribe answered ${response.status}`);
      said = readScribe(body);
      if (said === "") return json({ heard: null, notes: [], lines: [], error: "not_heard" });
    }

    const model = Deno.env.get("ANTHROPIC_INTERPRET_MODEL") || DEFAULT_INTERPRET_MODEL;
    const { url, init } = interpretRequest(env("ANTHROPIC_API_KEY"), model, said);
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`model answered ${response.status}`);
    const input = toolInput(body);
    if (input === null) throw new Error("model returned no reading");

    // The Seeker: category, card dates and instalments are hers to set by hand in the draft.
    const reading = readInterpretation(input, said, now, { byHand: true, lang });
    // The screen says which day; her words win only when she named one.
    if (!reading.daySaid) reading.day = chosenDay;
    // Counts only: refusals quote her words, which stay out of the log.
    if (reading.refusals.length) console.warn("diary-speak-seeker: refused", reading.refusals.length, "parts");

    const heard = audio ? said : null;
    if (reading.lines.length === 0) return json({ heard, notes: reading.notes, lines: [] });

    const { data: draftId, error } = await db.rpc("journal_draft_create", {
      p_entrepreneur_id: me.id,
      p_message_id: `seeker:speak:${requestId}`,
      p_source: audio ? "voice" : "text",
      p_transcript: said,
      p_day: reading.day,
      p_lines: reading.lines,
      p_model: model,
      p_prompt_version: INTERPRET_PROMPT_VERSION,
      p_transcriber: transcriber,
      p_refusals: reading.refusals,
    });
    if (error) throw new Error(`draft not kept: ${error.message}`);
    return json({ draft_id: draftId, day: reading.day, lines: reading.lines, notes: reading.notes, heard });
  } catch (e) {
    console.error("diary-speak-seeker failed", String(e).slice(0, 200));
    return json({ error: "unavailable" }, 503);
  }
});
