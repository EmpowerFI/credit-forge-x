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
  cogsCents: number;
  opexCents: number;
  householdCents: number;
  keepsRecords: boolean;
  activeDays: number;
}

/** One completed Flow, as it arrived. The id is Meta's, and it is how a retry is recognised. */
export interface FlowReply {
  messageId: string;
  responseJson: string;
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
    cogsCents: brlToCents(body.cogs_brl),
    opexCents: brlToCents(body.opex_brl),
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
        const m = message as { id?: unknown; interactive?: { type?: unknown; nfm_reply?: { response_json?: unknown } } };
        if (m?.interactive?.type !== "nfm_reply") continue;
        const responseJson = m.interactive.nfm_reply?.response_json;
        if (typeof m.id !== "string" || typeof responseJson !== "string") continue;
        out.push({ messageId: m.id, responseJson });
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
