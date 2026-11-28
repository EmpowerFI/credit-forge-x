import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  base64, DEFAULT_STT_MODEL, DEFAULT_TTS_MODEL, DEFAULT_VOICES, MAX_READBACK_CHARS, readBackText, readScribe, scribeRequest, ttsRequest,
  voiceAllowed, voiceLang,
} from "./elevenlabs.ts";

Deno.test("Scribe is asked in batch, with the language fixed and nothing extra", async () => {
  const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
  const { url, init } = scribeRequest("key-1", DEFAULT_STT_MODEL, audio, "voice.webm", "pt");
  assertEquals(url, "https://api.elevenlabs.io/v1/speech-to-text");
  assertEquals(init.method, "POST");
  assertEquals((init.headers as Record<string, string>)["xi-api-key"], "key-1");
  const form = init.body as FormData;
  assertEquals(form.get("model_id"), "scribe_v2");
  assertEquals(form.get("language_code"), "pt");
  assertEquals(form.get("tag_audio_events"), "false");
  assertEquals(form.get("diarize"), "false");
  const file = form.get("file") as File;
  assertEquals(file.name, "voice.webm");
  assertEquals(new Uint8Array(await file.arrayBuffer()), new Uint8Array([1, 2, 3]));
});

Deno.test("English is asked as English; anything else is Portuguese", () => {
  const audio = new Blob([]);
  assertEquals((scribeRequest("k", "m", audio, "v", "en").init.body as FormData).get("language_code"), "en");
  assertEquals(voiceLang("en"), "en");
  assertEquals(voiceLang("pt"), "pt");
  assertEquals(voiceLang("fr"), "pt");
  assertEquals(voiceLang(undefined), "pt");
});

Deno.test("what Scribe heard, trimmed and bounded", () => {
  assertEquals(readScribe({ text: "  vendi trinta reais  ", language_code: "por" }), "vendi trinta reais");
  assertEquals(readScribe({ text: "a".repeat(6000) }).length, 5000);
  assertEquals(readScribe({}), "");
  assertEquals(readScribe(null), "");
});

Deno.test("only the listed e-mails may use the voice", () => {
  const list = " founder@x.io , Tester@X.io,";
  assert(voiceAllowed("founder@x.io", list));
  assert(voiceAllowed("TESTER@x.io", list));
  assertFalse(voiceAllowed("other@x.io", list));
  assertFalse(voiceAllowed("founder@x.io", undefined));
  assertFalse(voiceAllowed("founder@x.io", ""));
  assertFalse(voiceAllowed(null, list));
});

Deno.test("the read-back says what was understood, in her language, and asks", () => {
  const lines = [
    { kind: "sale" as const, amount_cents: 35_000, payment_method: "credit_card" },
    { kind: "expense" as const, amount_cents: 4_050, payment_method: "pix" },
  ];
  assertEquals(readBackText(lines, "pt"),
    "Entendi: venda de 350 reais no cartão de crédito e gasto de 40 reais e 50 centavos no Pix. Está certo?");
  assertEquals(readBackText(lines, "en"),
    "I understood: a sale of 350 reais by credit card and an expense of 40 reais and 50 cents by Pix. Is that right?");
  assertEquals(readBackText([lines[0]], "pt"), "Entendi: venda de 350 reais no cartão de crédito. Está certo?");
  const many = Array.from({ length: 20 }, () => lines[0]);
  assert(readBackText(many, "pt").length <= MAX_READBACK_CHARS);
});

Deno.test("the voice is asked with Flash, her voice and a small mp3", () => {
  const { url, init } = ttsRequest("key-2", DEFAULT_VOICES.pt, DEFAULT_TTS_MODEL, "Entendi.");
  assertEquals(url, "https://api.elevenlabs.io/v1/text-to-speech/33B4UnXyTNbgLmdEDh5P?output_format=mp3_22050_32");
  assertEquals((init.headers as Record<string, string>)["xi-api-key"], "key-2");
  assertEquals(JSON.parse(init.body as string), { text: "Entendi.", model_id: "eleven_flash_v2_5" });
  assertEquals(DEFAULT_VOICES.en, "cgSgspJ2msm6clMCkdW9");
});

Deno.test("base64 of the audio, whatever its length", () => {
  assertEquals(base64(new Uint8Array([104, 105])), "aGk=");
  const big = new Uint8Array(100_000).fill(65);
  assertEquals(atob(base64(big)).length, 100_000);
});
