import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { DEFAULT_STT_MODEL, readScribe, scribeRequest, voiceAllowed, voiceLang } from "./elevenlabs.ts";

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
