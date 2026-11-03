import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { decodeVapidKeys, isPushService, outcomeOf, reminderNotification, testNotification } from "./push.ts";

Deno.test("a reminder carries no figure, and its tap opens the diary with its id", () => {
  const n = reminderNotification("daily", "6c1f0a8e-0000-4000-8000-000000000001");
  assertEquals(n.title, "Como foram suas vendas hoje? 💜");
  assertEquals(n.url, "/app/diario?lembrete=6c1f0a8e-0000-4000-8000-000000000001");
  for (const text of [n.title, n.body, reminderNotification("pause", "x").body, testNotification().body]) {
    assert(!/R\$|\d{2,}/.test(text), `no amount in: ${text}`);
  }
  assertEquals(reminderNotification("pause", "x").title, "Vamos pausar os lembretes");
});

Deno.test("a push service's answer, as it is recorded", () => {
  assertEquals(outcomeOf(201), "accepted");
  assertEquals(outcomeOf(200), "accepted");
  assertEquals(outcomeOf(410), "gone");
  assertEquals(outcomeOf(404), "gone");
  assertEquals(outcomeOf(403), "failed");
  assertEquals(outcomeOf(429), "failed");
  assertEquals(outcomeOf(500), "failed");
});

Deno.test("only the browsers' push services are ever called", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://web.push.apple.com/QGx2",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
  ]) assert(isPushService(ok), ok);
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/x",
    "https://fcm.googleapis.com:8443/fcm/send/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example/fcm.googleapis.com",
    "https://169.254.169.254/latest",
    "https://push.apple.com.example.org/x",
    "not a url",
  ]) assert(!isPushService(bad), bad);
});

Deno.test("the VAPID pair is read from its base64url JSON, and nothing else is accepted", () => {
  const pair = {
    publicKey: { kty: "EC", crv: "P-256", x: "x", y: "y" },
    privateKey: { kty: "EC", crv: "P-256", x: "x", y: "y", d: "d" },
  };
  const b64 = btoa(JSON.stringify(pair)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assertEquals(decodeVapidKeys(b64), pair);
  const noPrivate = btoa(JSON.stringify({ publicKey: pair.publicKey, privateKey: pair.publicKey }));
  assertThrows(() => decodeVapidKeys(noPrivate));
});
