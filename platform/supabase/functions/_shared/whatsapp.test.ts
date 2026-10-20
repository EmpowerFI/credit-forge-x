import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  brlToCents, canonicalPhone, flowReplies, sendTextRequest, signatureMatches, textMessages,
} from "./whatsapp.ts";

Deno.test("reais as a woman writes them", () => {
  assertEquals(brlToCents("1234"), 123_400);
  assertEquals(brlToCents("1234,56"), 123_456);
  assertEquals(brlToCents("1.234,56"), 123_456);
  assertEquals(brlToCents("1.234"), 123_400);
  assertEquals(brlToCents("1234.56"), 123_456);
  assertEquals(brlToCents("R$ 1.234,56"), 123_456);
  assertEquals(brlToCents("R$1.234,56"), 123_456);
  assertEquals(brlToCents("0"), 0);
  assertEquals(brlToCents("0,50"), 50);
  assertEquals(brlToCents("0,5"), 50);
  assertEquals(brlToCents("1,2"), 120);
});

Deno.test("no float ever touches the figure", () => {
  // 19.99 * 100 is 1998.9999999999998 in IEEE 754, and this number becomes a debt.
  assertEquals(brlToCents("19,99"), 1999);
  assertEquals(brlToCents("8.299,99"), 829_999);
  assertEquals(brlToCents("99999999,99"), 9_999_999_999);
});

Deno.test("what it refuses rather than interprets", () => {
  assertThrows(() => brlToCents("1,234.56"), Error, "not a BRL amount"); // en-US
  assertThrows(() => brlToCents("1.234,567"));                           // three decimals
  assertThrows(() => brlToCents("-100"));
  assertThrows(() => brlToCents("mil reais"));
  assertThrows(() => brlToCents(""));
  assertThrows(() => brlToCents("12.34.56"));
  assertThrows(() => brlToCents("1234,"));
  assertThrows(() => brlToCents(1234), Error, "not a written amount"); // a number is not what a Flow sends
  assertThrows(() => brlToCents(null));
  assertThrows(() => brlToCents(undefined));
  assertThrows(() => brlToCents("100000000,01"), Error, "above the ceiling");
});

const COMPLETE = JSON.stringify({ flow_token: "journal", day: "today" });

Deno.test("one delivery can carry several, and most of it is not ours", () => {
  const body = {
    entry: [{
      changes: [{
        value: {
          messages: [
            { id: "wamid.1", type: "text", text: { body: "oi" } },
            { id: "wamid.2", type: "interactive", interactive: { type: "nfm_reply", nfm_reply: { response_json: COMPLETE } } },
            { id: "wamid.3", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "x" } } },
          ],
        },
      }, { value: { statuses: [{ id: "wamid.9", status: "delivered" }] } }],
    }],
  };
  assertEquals(flowReplies(body).map((r) => r.messageId), ["wamid.2"]);
});

Deno.test("a webhook that throws stops receiving the ones that matter", () => {
  assertEquals(flowReplies({}), []);
  assertEquals(flowReplies(null), []);
  assertEquals(flowReplies({ entry: "nope" }), []);
  assertEquals(flowReplies({ entry: [{ changes: [{ value: {} }] }] }), []);
  assertEquals(flowReplies({ entry: [{ changes: [{ value: { messages: [{ interactive: { type: "nfm_reply" } }] } }] }] }), []);
});

// Computed once with Deno's own HMAC over this body and secret, so the test
// pins the wire format rather than restating the implementation.
const BODY = '{"object":"whatsapp_business_account"}';
const SECRET = "app-secret";

Deno.test("the signature is over the bytes Meta sent", async () => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(BODY));
  const good = "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");

  assertEquals(await signatureMatches(BODY, good, SECRET), true);
  assertEquals(await signatureMatches(BODY, good, "wrong-secret"), false);
  // Re-serialising changes the bytes, and the signature is over the bytes.
  assertEquals(await signatureMatches(JSON.stringify(JSON.parse(BODY)) + " ", good, SECRET), false);
  assertEquals(await signatureMatches(BODY, null, SECRET), false);
  assertEquals(await signatureMatches(BODY, "", SECRET), false);
  assertEquals(await signatureMatches(BODY, good.slice(7), SECRET), false); // no sha256= prefix
  assertEquals(await signatureMatches(BODY, "sha256=deadbeef", SECRET), false);
});


Deno.test("the same woman is one number, however it arrives", () => {
  const HERS = "+5511987654321";
  // What Meta's wa_id can say for a Brazilian mobile: no ninth digit.
  assertEquals(canonicalPhone("551187654321"), HERS);
  // What she has, what she types, what an operator copies from a contact list.
  assertEquals(canonicalPhone("5511987654321"), HERS);
  assertEquals(canonicalPhone("+55 (11) 98765-4321"), HERS);
  assertEquals(canonicalPhone("11987654321"), HERS);
  assertEquals(canonicalPhone("(11) 98765-4321"), HERS);
  assertEquals(canonicalPhone(" +55 11 9 8765 4321 "), HERS);
});

Deno.test("a landline keeps its eight digits", () => {
  // 2 to 5 opens a fixed line; restoring a ninth digit there invents a number.
  assertEquals(canonicalPhone("551132654321"), "+551132654321");
  assertEquals(canonicalPhone("1132654321"), "+551132654321");
  assertEquals(canonicalPhone("+55 (11) 3265-4321"), "+551132654321");
});

Deno.test("every area code, not just the ones with nine digits already", () => {
  assertEquals(canonicalPhone("5585988887777"), "+5585988887777"); // Fortaleza
  assertEquals(canonicalPhone("558588887777"), "+5585988887777");  // the same, as wa_id
  assertEquals(canonicalPhone("5591988887777"), "+5591988887777"); // Belém
  assertEquals(canonicalPhone("559188887777"), "+5591988887777");
});

Deno.test("another country's numbering plan is not ours to guess", () => {
  assertEquals(canonicalPhone("+1 415 555 0132"), "+14155550132");
  assertEquals(canonicalPhone("351912345678"), "+351912345678");
  assertEquals(canonicalPhone("+44 20 7946 0958"), "+442079460958");
});

Deno.test("what is not a number at all", () => {
  assertThrows(() => canonicalPhone("1234567"));       // too short
  assertThrows(() => canonicalPhone("1".repeat(16)));  // too long
  assertThrows(() => canonicalPhone(""));
  assertThrows(() => canonicalPhone("nao tenho"));
  assertThrows(() => canonicalPhone(5511987654321));
  assertThrows(() => canonicalPhone(null));
});

Deno.test("canonicalising twice changes nothing", () => {
  // The index is built from this string; if it were not stable, a second
  // pass over the same number would create a second woman.
  for (const n of ["551187654321", "+55 (11) 98765-4321", "1132654321", "+1 415 555 0132"]) {
    assertEquals(canonicalPhone(canonicalPhone(n)), canonicalPhone(n));
  }
});

Deno.test("a text message and a form answer are different things", () => {
  const body = {
    entry: [{
      changes: [{
        value: {
          messages: [
            { id: "wamid.t1", from: "551187654321", type: "text", text: { body: "oi" } },
            { id: "wamid.f1", type: "interactive", interactive: { type: "nfm_reply", nfm_reply: { response_json: COMPLETE } } },
            { id: "wamid.t2", from: "5511987654321", type: "text", text: { body: "  sim  " } },
            { id: "wamid.x", from: "55119", type: "image", image: { id: "i" } },
          ],
        },
      }],
    }],
  };
  assertEquals(textMessages(body).map((m) => m.messageId), ["wamid.t1", "wamid.t2"]);
  assertEquals(flowReplies(body).map((r) => r.messageId), ["wamid.f1"]);
  assertEquals(textMessages(body)[0].from, "551187654321");
  assertEquals(textMessages(body)[1].text, "  sim  ");
});

Deno.test("a delivery with nothing of ours in it", () => {
  assertEquals(textMessages({}), []);
  assertEquals(textMessages({ entry: [{ changes: [{ value: { statuses: [{ id: "x" }] } }] }] }), []);
  assertEquals(textMessages({ entry: [{ changes: [{ value: { messages: [{ type: "text" }] } }] }] }), []);
});

Deno.test("the send request, without a token and without Meta", () => {
  const { url, init } = sendTextRequest("123456", "+5511987654321", "Oi!");
  assertEquals(url, "https://graph.facebook.com/v21.0/123456/messages");
  assertEquals(init.method, "POST");
  assertEquals(JSON.parse(String(init.body)), {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "+5511987654321",
    type: "text",
    // Off, because a link preview turns her own words into a card and
    // sometimes fetches the link from our servers.
    text: { preview_url: false, body: "Oi!" },
  });
});
