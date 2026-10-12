import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { activeDays, brlToCents, flowReplies, optIn, parseFlowReply, signatureMatches } from "./whatsapp.ts";

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

Deno.test("a fortnight has fifteen days", () => {
  assertEquals(activeDays("0"), 0);
  assertEquals(activeDays("12"), 12);
  assertEquals(activeDays("15"), 15);
  assertEquals(activeDays(15), 15);
  assertThrows(() => activeDays("16"), Error, "fifteen days");
  assertThrows(() => activeDays("31"), Error, "fifteen days"); // a month filled into a half
  assertThrows(() => activeDays("-1"));
  assertThrows(() => activeDays("7,5"));
  assertThrows(() => activeDays(""));
});

Deno.test("an unchecked box is a no, not a missing answer", () => {
  assertEquals(optIn(undefined), false);
  assertEquals(optIn(""), false);
  assertEquals(optIn("false"), false);
  assertEquals(optIn("true"), true);
  assertEquals(optIn(true), true);
  assertThrows(() => optIn("sim"));
});

const COMPLETE = JSON.stringify({
  flow_token: "tok_abc",
  revenue_brl: "3.450,00",
  active_days: "11",
  keeps_records: "true",
  cogs_brl: "1.200,50",
  opex_brl: "180",
  household_brl: "900,00",
});

Deno.test("the completion payload, field by field", () => {
  assertEquals(parseFlowReply(COMPLETE), {
    flowToken: "tok_abc",
    revenueCents: 345_000,
    cogsCents: 120_050,
    opexCents: 18_000,
    householdCents: 90_000,
    keepsRecords: true,
    activeDays: 11,
  });
});

Deno.test("no token, no check-in", () => {
  assertThrows(() => parseFlowReply(JSON.stringify({ revenue_brl: "100" })), Error, "no flow token");
  assertThrows(() => parseFlowReply(JSON.stringify({ flow_token: "  ", revenue_brl: "100" })), Error, "no flow token");
  assertThrows(() => parseFlowReply("not json"), Error, "not JSON");
});

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

