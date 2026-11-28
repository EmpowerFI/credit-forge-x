// ElevenLabs for the Seeker app's voice (PLAN_SEEKER.md §2.2): Scribe hears
// her voice note. Batch, never realtime, which costs more. The web diary's
// diary-speak keeps OpenAI; only diary-speak-seeker calls this.

/** Batch Scribe; the same price as scribe_v3 on 25/11/2026. ELEVENLABS_STT_MODEL overrides it. */
export const DEFAULT_STT_MODEL = "scribe_v2";

export type VoiceLang = "pt" | "en";

export const voiceLang = (value: unknown): VoiceLang => (value === "en" ? "en" : "pt");

export function scribeRequest(apiKey: string, model: string, audio: Blob, filename: string, lang: VoiceLang): { url: string; init: RequestInit } {
  const form = new FormData();
  form.append("model_id", model);
  form.append("file", audio, filename);
  // Fixed, not detected: a short note is where detection goes wrong.
  form.append("language_code", lang);
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");
  return {
    url: "https://api.elevenlabs.io/v1/speech-to-text",
    init: { method: "POST", headers: { "xi-api-key": apiKey }, body: form },
  };
}

/** What Scribe heard, at most 5000 characters; "" when it heard nothing. */
export function readScribe(body: unknown): string {
  const text = (body as { text?: unknown } | null)?.text;
  return typeof text === "string" ? text.trim().slice(0, 5_000) : "";
}

/**
 * During the hackathon the voice is for the founder and testers only
 * (founder, 18/11/2026): SEEKER_VOICE_ALLOW lists their e-mails, separated by
 * commas. Nobody is allowed when it is unset.
 */
export function voiceAllowed(email: string | null | undefined, list: string | undefined): boolean {
  if (!email || !list) return false;
  const me = email.trim().toLowerCase();
  return list.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(me);
}
