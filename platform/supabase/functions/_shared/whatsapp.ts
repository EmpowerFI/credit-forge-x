// whatsapp — reading what she typed into a Flow, and refusing to guess.
//
// A check-in Flow with no data endpoint returns everything she filled in as
// one JSON string inside the completion webhook: interactive.nfm_reply
// .response_json. That string is the only thing the platform gets, and the
// conversion from what it says to what the engine stores is the most
// dangerous line in the whole WhatsApp layer -- a comma read as a decimal
// point anchors a commitment to a number she never said.
//
// So nothing here guesses. "1.234,56" is pt-BR and means 1234 reais and 56
// centavos. "1,234.56" is en-US, nobody in this product types it, and it is
// refused rather than interpreted. Every refusal names what it refused.
//
// Pure on purpose: no network, no database, no Deno APIs except WebCrypto for
// the signature. It is the part of the layer that can be tested without Meta,
// without a number, and without a row in any table.

/** The six answers one fortnight of one business, as the database wants them. */
export interface CheckinHalf {
  flowToken: string;
  revenueCents: number;
  /** null is "não sei": she left it blank. Never zero -- zero is a figure she would have typed. */
  cogsCents: number | null;
  opexCents: number | null;
  householdCents: number;
  keepsRecords: boolean;
  activeDays: number;
}

/** One completed Flow, as it arrived. The id is Meta's, and it is how a retry is recognised. */
export interface FlowReply {
  messageId: string;
  responseJson: string;
  /** Meta's wa_id for whoever answered -- where the month's reading goes back to. */
  from: string | null;
}

/** The same ceiling the checkins table carries: a hundred million reais is not a figure, it is a bug. */
const MAX_CENTS = 10_000_000_000;

/**
 * Reais as a human writes them, to cents, exactly.
 *
 * Accepted: `1234`, `1234,56`, `1234.56`, `1.234`, `1.234,56`, with an
 * optional `R$` and any spacing. Refused: anything else, including the
 * en-US `1,234.56`, three decimal places, and a negative.
 *
 * The arithmetic is on digit strings rather than on a float, because
 * `19.99 * 100` is `1998.9999999999998` and this number becomes a debt.
 */
export function brlToCents(raw: unknown): number {
  if (typeof raw !== "string") throw new Error(`not a written amount: ${JSON.stringify(raw)}`);
  // \s already covers the non-breaking space a phone keyboard can produce.
  const s = raw.replace(/\s/g, "").replace(/^R\$?/i, "");
  if (s === "") throw new Error("empty amount");

  let intPart: string;
  let fracPart = "";

  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) {
    // 1.234,56 -- grouped, pt-BR decimals
    const [i, f] = s.split(",");
    intPart = i.replaceAll(".", "");
    fracPart = f;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // 1.234 -- grouped, no decimals. Three digits after a dot are never cents.
    intPart = s.replaceAll(".", "");
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    // 1234,56
    [intPart, fracPart] = s.split(",");
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // 1234.56 -- a keyboard that gave her a dot
    [intPart, fracPart] = s.split(".");
  } else if (/^\d+$/.test(s)) {
    intPart = s;
  } else {
    throw new Error(`not a BRL amount this product accepts: ${JSON.stringify(raw)}`);
  }

  const cents = BigInt(intPart) * 100n + BigInt(fracPart.padEnd(2, "0") || "0");
  if (cents > BigInt(MAX_CENTS)) throw new Error(`amount above the ceiling: ${JSON.stringify(raw)}`);
  return Number(cents);
}

/**
 * A cost she may not know. Blank, or absent from the payload, is "não sei"
 * and comes back as null; anything written is read exactly as brlToCents
 * reads it, and refused the same way. A blank is never turned into 0: a zero
 * cost invents a better month than she had.
 */
export function optionalBrlToCents(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  return brlToCents(raw);
}

/**
 * Days worked in a fortnight: 0 to 15.
 *
 * The checkins table validates 0 to 31 because it holds a month, and a month
 * is two of these added together. A half that claims 31 is a half filled in
 * as though it were a month, and the sum would be a lie about a whole year of
 * consistency, so it is refused here rather than corrected.
 */
export function activeDays(raw: unknown): number {
  const s = typeof raw === "number" ? String(raw) : raw;
  if (typeof s !== "string" || !/^\d{1,2}$/.test(s.trim())) {
    throw new Error(`not a count of days: ${JSON.stringify(raw)}`);
  }
  const n = Number(s.trim());
  if (n > 15) throw new Error(`a fortnight has fifteen days, not ${n}`);
  return n;
}

/** An unchecked OptIn is absent from the payload, which is a no rather than a missing answer. */
export function optIn(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === "") return false;
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`not a yes or a no: ${JSON.stringify(raw)}`);
}

/**
 * The completion payload, checked field by field.
 *
 * The flow token is what says which woman, which month and which half -- in a
 * Flow with no endpoint nothing else can carry it -- so an absent or empty one
 * is refused before any figure is read.
 */
export function parseFlowReply(responseJson: string): CheckinHalf {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(responseJson) as Record<string, unknown>;
  } catch {
    throw new Error("response_json is not JSON");
  }
  if (body === null || typeof body !== "object") throw new Error("response_json is not an object");

  const flowToken = body.flow_token;
  if (typeof flowToken !== "string" || flowToken.trim() === "") throw new Error("no flow token in the reply");

  return {
    flowToken: flowToken.trim(),
    revenueCents: brlToCents(body.revenue_brl),
    cogsCents: optionalBrlToCents(body.cogs_brl),
    opexCents: optionalBrlToCents(body.opex_brl),
    householdCents: brlToCents(body.household_brl),
    keepsRecords: optIn(body.keeps_records),
    activeDays: activeDays(body.active_days),
  };
}

/**
 * Every completed Flow in a webhook delivery.
 *
 * Meta batches, so one POST can carry several, and it also carries statuses,
 * text messages and reactions that are not ours. Anything that is not a
 * completed Flow is skipped in silence; anything shaped wrong is skipped too,
 * because a webhook that throws on an unexpected message stops receiving the
 * expected ones.
 */
export function flowReplies(body: unknown): FlowReply[] {
  const out: FlowReply[] = [];
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown } })?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        const m = message as {
          id?: unknown;
          from?: unknown;
          interactive?: { type?: unknown; nfm_reply?: { response_json?: unknown } };
        };
        if (m?.interactive?.type !== "nfm_reply") continue;
        const responseJson = m.interactive.nfm_reply?.response_json;
        if (typeof m.id !== "string" || typeof responseJson !== "string") continue;
        out.push({ messageId: m.id, responseJson, from: typeof m.from === "string" ? m.from : null });
      }
    }
  }
  return out;
}

/** Hex, lowercase, for comparing against Meta's header. */
function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * X-Hub-Signature-256, over the raw body.
 *
 * Over the *raw* body and not over a re-serialised object: Meta signs the
 * bytes it sent, and JSON.stringify(JSON.parse(x)) is not x. Without this
 * check the endpoint is a public write to a woman's revenue, since the URL is
 * all anyone would need.
 */
export async function signatureMatches(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------------------ numbers

/**
 * A phone number as one canonical string, because the same woman must not
 * become two rows.
 *
 * Brazil has a trap in it. Mobile numbers gained a ninth digit, and Meta's
 * `wa_id` for a Brazilian mobile often arrives WITHOUT it -- 5511987654321 is
 * the number she has, 551187654321 is what the webhook can say -- while the
 * display number, anything she types, and anything an operator copies from a
 * contact list carry the nine. Indexed as they arrive, those are two
 * different people: her check-ins land under one and her report under the
 * other, and nothing ever says they disagreed.
 *
 * So the ninth digit is restored. A Brazilian subscriber number of eight
 * digits beginning 6 to 9 is a mobile missing it; one beginning 2 to 5 is a
 * landline and is left alone.
 *
 * Numbers outside Brazil are kept as they came, with only the formatting
 * removed: guessing at another country's numbering plan is how this kind of
 * function starts corrupting data it was supposed to tidy.
 */
export function canonicalPhone(raw: unknown): string {
  if (typeof raw !== "string") throw new Error(`not a phone number: ${JSON.stringify(raw)}`);
  // A leading + says the number already carries its country code, and it is
  // then never reinterpreted: +1 415 555 0132 is eleven digits, exactly like
  // a Brazilian mobile written locally, and reading it as one would move a
  // woman in San Francisco to São Paulo.
  const international = raw.trim().startsWith("+");
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error(`not a phone number: ${JSON.stringify(raw)}`);

  // Brazil, with or without the country code. Ten and eleven digits and no
  // country code are the local forms: area code plus eight or nine. A bare
  // ten or eleven digits is read as Brazilian because that is who this
  // product is for; written with a +, it is not.
  let national: string | null = null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) national = digits.slice(2);
  else if (!international && !digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) national = digits;

  if (national === null) return `+${digits}`;

  const area = national.slice(0, 2);
  const subscriber = national.slice(2);
  // Brazilian area codes run 11 to 99; anything else is not one, and the
  // number is better left as it came than reshaped on a wrong assumption.
  if (Number(area) < 11) return `+${digits}`;

  if (subscriber.length === 8 && /^[6-9]/.test(subscriber)) return `+55${area}9${subscriber}`;
  return `+55${area}${subscriber}`;
}

// ----------------------------------------------------------------- messages

/** A plain text message, which is how the entry conversation arrives. */
export interface TextMessage {
  messageId: string;
  /** Meta's wa_id for the sender: the phone number, in whatever shape it sends. */
  from: string;
  text: string;
}

/**
 * Every plain text message in a delivery.
 *
 * Separate from flowReplies because they go to different places -- a form
 * answer is a fortnight, a text is a turn of the conversation -- and because
 * one delivery can carry both.
 */
export function textMessages(body: unknown): TextMessage[] {
  const out: TextMessage[] = [];
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown } })?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        const m = message as { id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown } };
        if (m?.type !== "text") continue;
        if (typeof m.id !== "string" || typeof m.from !== "string" || typeof m.text?.body !== "string") continue;
        out.push({ messageId: m.id, from: m.from, text: m.text.body });
      }
    }
  }
  return out;
}

/**
 * The Graph API call that sends her a message.
 *
 * Built rather than sent, so the shape can be tested without a token and
 * without reaching Meta. Free-form text is only deliverable inside the
 * twenty-four hours after she last wrote, which is exactly when the entry
 * conversation happens -- so none of this is billed.
 */
export function sendTextRequest(phoneNumberId: string, to: string, body: string): { url: string; init: RequestInit } {
  return {
    url: `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    },
  };
}
