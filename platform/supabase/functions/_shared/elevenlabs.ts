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

// ------------------------------------------------------------ read back

/** The cheapest and fastest voice model (Flash). ELEVENLABS_TTS_MODEL overrides it. */
export const DEFAULT_TTS_MODEL = "eleven_flash_v2_5";
/** The founder's voices (27/11/2026). ELEVENLABS_VOICE_ID_PT / _EN override them. Not secrets. */
export const DEFAULT_VOICES: Record<VoiceLang, string> = { pt: "33B4UnXyTNbgLmdEDh5P", en: "cgSgspJ2msm6clMCkdW9" };
/** A read-back is two short sentences; longer is not sent, which caps what a day can cost. */
export const MAX_READBACK_CHARS = 400;

export interface ReadLine {
  kind: "sale" | "expense";
  amount_cents: number;
  payment_method: string;
}

const METHOD_WORDS: Record<VoiceLang, Record<string, string>> = {
  pt: { pix: "no Pix", cash: "em dinheiro", debit_card: "no débito", credit_card: "no cartão de crédito", fiado: "fiado" },
  en: { pix: "by Pix", cash: "in cash", debit_card: "by debit card", credit_card: "by credit card", fiado: "on tab" },
};

function reaisSaid(cents: number, lang: VoiceLang): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  if (lang === "en") return rest ? `${whole} reais and ${rest} cents` : `${whole} reais`;
  return rest ? `${whole} reais e ${rest} centavos` : `${whole} reais`;
}

/**
 * What the app says back before she confirms (PLAN_SEEKER.md §2.2): what it
 * understood, then that she checks it. The tap decides; the voice informs.
 */
export function readBackText(lines: ReadLine[], lang: VoiceLang): string {
  const parts = lines.slice(0, 5).map((l) => {
    const method = METHOD_WORDS[lang][l.payment_method] ?? "";
    if (lang === "en") return `${l.kind === "sale" ? "a sale" : "an expense"} of ${reaisSaid(l.amount_cents, lang)} ${method}`.trim();
    return `${l.kind === "sale" ? "venda" : "gasto"} de ${reaisSaid(l.amount_cents, lang)} ${method}`.trim();
  });
  const list = parts.length <= 1 ? parts.join("")
    : `${parts.slice(0, -1).join(", ")}${lang === "en" ? " and " : " e "}${parts[parts.length - 1]}`;
  const text = lang === "en"
    ? `I understood: ${list}. Is that right?`
    : `Entendi: ${list}. Está certo?`;
  return text.slice(0, MAX_READBACK_CHARS);
}

export function ttsRequest(apiKey: string, voiceId: string, model: string, text: string): { url: string; init: RequestInit } {
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`,
    init: {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model }),
    },
  };
}

/** Bytes to base64, in chunks: a read-back is a few dozen kilobytes. */
export function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
