// Commitments: how a database record becomes the 32 bytes the chain stores.
//
//   commitment = SHA-256( utf8(domain) ‖ 0x00 ‖ utf8(canonicalJson(payload)) )
//
// The same function runs in the browser (the audit screen recomputes it) and
// in Deno (the Edge Function that anchors it). If the two ever disagree, every
// proof reads MISMATCH — so this module depends on nothing but WebCrypto and
// TextEncoder, and golden vectors pin its output on both sides.
//
// The domain tag keeps one kind of record from ever colliding with another: a
// check-in and a readiness assessment with identical fields still commit to
// different hashes. The trailing :v1 is the schema version the program stores
// alongside each commitment; changing what a payload contains means a new tag.

export const DOMAINS = {
  COMMUNITY: "EMPOWERFI:COMMUNITY:v1",
  COMMUNITY_VERIFICATION: "EMPOWERFI:COMMUNITY_VERIFICATION:v1",
  BORROWER_REF: "EMPOWERFI:BORROWER_REF:v1",
  ENROLLMENT: "EMPOWERFI:ENROLLMENT:v1",
  CHECKIN: "EMPOWERFI:CHECKIN:v1",
  READINESS: "EMPOWERFI:READINESS:v1",
  ELIGIBILITY: "EMPOWERFI:ELIGIBILITY:v1",
  OPPORTUNITY: "EMPOWERFI:OPPORTUNITY:v1",
  LOAN: "EMPOWERFI:LOAN:v1",
  LOAN_TRANSITION: "EMPOWERFI:LOAN_TRANSITION:v1",
  PAYMENT: "EMPOWERFI:PAYMENT:v1",
  OUTCOME: "EMPOWERFI:OUTCOME:v1",
  ALLOCATION: "EMPOWERFI:ALLOCATION:v1",
  ALLOCATION_REF: "EMPOWERFI:ALLOCATION_REF:v1",
} as const;

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS];

/**
 * The domain each kind of anchor (public.anchor_kind) commits under. One table
 * for the Edge Function that writes and the browser that audits, so the two
 * cannot pick different tags for the same fact.
 */
export const ANCHOR_DOMAINS = {
  community: DOMAINS.COMMUNITY,
  community_verification: DOMAINS.COMMUNITY_VERIFICATION,
  enrollment: DOMAINS.ENROLLMENT,
  checkin: DOMAINS.CHECKIN,
  readiness: DOMAINS.READINESS,
  eligibility: DOMAINS.ELIGIBILITY,
  opportunity: DOMAINS.OPPORTUNITY,
  loan: DOMAINS.LOAN,
  loan_transition: DOMAINS.LOAN_TRANSITION,
  payment: DOMAINS.PAYMENT,
  outcome: DOMAINS.OUTCOME,
  allocation: DOMAINS.ALLOCATION,
} as const satisfies Record<string, Domain>;

export type AnchorKind = keyof typeof ANCHOR_DOMAINS;

export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export type CanonicalObject = { [key: string]: CanonicalValue };

export class CanonicalizationError extends Error {
  constructor(path: string, reason: string) {
    super(`Cannot canonicalize ${path || "<root>"}: ${reason}`);
    this.name = "CanonicalizationError";
  }
}

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Canonical JSON, a strict subset of RFC 8785 (JCS): object keys sorted by
 * UTF-16 code units, no whitespace, strings escaped as JSON.stringify does.
 *
 * Stricter than JCS on purpose, so that nothing about a payload is left to
 * interpretation:
 *  - numbers must be safe integers. Money is integer cents and rates are
 *    basis points; a float has more than one defensible decimal rendering.
 *  - `undefined` is an error, never silently dropped: `{a: undefined}` and
 *    `{}` must not hash the same by accident. Use null.
 *  - only plain objects and arrays. A Date or a class instance has to be
 *    turned into a string or number by the caller, deliberately.
 */
export function canonicalize(value: CanonicalValue, path = ""): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalizationError(path, `${value} is not a safe integer`);
      }
      return String(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item, i) => canonicalize(item, `${path}[${i}]`)).join(",")}]`;
      }
      if (!isPlainObject(value)) {
        throw new CanonicalizationError(path, "only plain objects and arrays are allowed");
      }
      const keys = Object.keys(value).sort();
      const members = keys.map((key) => {
        const child = value[key];
        if (child === undefined) {
          throw new CanonicalizationError(`${path}.${key}`, "undefined is not allowed, use null");
        }
        return `${JSON.stringify(key)}:${canonicalize(child, `${path}.${key}`)}`;
      });
      return `{${members.join(",")}}`;
    }
    default:
      throw new CanonicalizationError(path, `${typeof value} is not a JSON value`);
  }
}

const encoder = new TextEncoder();

// WebCrypto wants an ArrayBuffer-backed view; withDomain always builds one.
async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

function withDomain(domain: Domain, body: Uint8Array): Uint8Array<ArrayBuffer> {
  const tag = encoder.encode(domain);
  const message = new Uint8Array(tag.length + 1 + body.length);
  message.set(tag, 0);
  message[tag.length] = 0x00;
  message.set(body, tag.length + 1);
  return message;
}

/** The 32-byte commitment to a record, as the chain stores it. */
export async function commit(domain: Domain, payload: CanonicalObject): Promise<Uint8Array> {
  return sha256(withDomain(domain, encoder.encode(canonicalize(payload))));
}

/**
 * What the chain knows a borrower by. The ref itself is 32 random bytes held
 * only in the database; publishing its hash lets the chain key her account
 * without handing anyone the ref.
 */
export async function hashBorrowerRef(borrowerRef: Uint8Array): Promise<Uint8Array> {
  if (borrowerRef.length !== 32) {
    throw new Error(`borrower_ref must be 32 bytes, got ${borrowerRef.length}`);
  }
  return sha256(withDomain(DOMAINS.BORROWER_REF, borrowerRef));
}

/**
 * What the chain knows an allocation by: like a borrower ref, 32 random bytes
 * held only in the database, so the account points to neither the investor
 * nor the borrower.
 */
export async function hashAllocationRef(allocationRef: Uint8Array): Promise<Uint8Array> {
  if (allocationRef.length !== 32) {
    throw new Error(`allocation_ref must be 32 bytes, got ${allocationRef.length}`);
  }
  return sha256(withDomain(DOMAINS.ALLOCATION_REF, allocationRef));
}

/** 32 random bytes, for `borrower_ref` and `community_ref`. Never derived from anything. */
export function randomRef(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("\\x") ? hex.slice(2) : hex; // Postgres bytea output
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
    throw new Error(`not a hex string: ${hex}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Constant-shape comparison of two commitments. */
export function sameCommitment(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
