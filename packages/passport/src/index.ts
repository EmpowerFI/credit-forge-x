// Business Passport, v1 — the signed record of one month of a business.
//
// One credential per monthly snapshot version: a W3C Verifiable Credential
// (Data Model 2.0) secured with SD-JWT, as VC-JOSE-COSE describes it
// (`typ: vc+sd-jwt`, ES256). The month's indicators are selectively
// disclosable claims; everything else -- the month, the version, the method,
// the evidence level -- is always visible. A share shows a recipient only
// the disclosures she authorised, from the same signed credential.
//
// Revocation is a W3C Bitstring Status List v1.0: a credential is revoked when
// its month is corrected (a new version supersedes it) or when she is erased.
//
// There is no holder key binding: she holds no wallet, EmpowerFI keeps the
// credential on her behalf and presents it only under a share she authorised.
// Said plainly in docs/PASSPORT.md.
//
// Pure WebCrypto and CompressionStream, so the browser, Node and Deno run
// this same file. The Edge Functions run a byte-identical copy
// (npm run platform:sync-shared).

export const PASSPORT_VERSION = "passport-v1.0.0";
export const VC_CONTEXT = "https://www.w3.org/ns/credentials/v2";
export const CREDENTIAL_TYP = "vc+sd-jwt";
export const STATUS_LIST_TYP = "vc+jwt";
/** The W3C minimum, so one revocation cannot be told apart from the rest. */
export const STATUS_LIST_BITS = 131072;

/**
 * The indicators a credential carries as disclosable claims, with the share
 * vocabulary's keys (private.share_indicators in the database).
 */
export const DISCLOSABLE = [
  "revenue_cents",
  "business_expenses_cents",
  "business_balance_cents",
  "days_kept",
  "selling_days",
  "receivable_cents",
  "payable_cents",
  "withdrawals_cents",
  "financing_cents",
] as const;
export type Disclosable = (typeof DISCLOSABLE)[number];

// --------------------------------------------------------------- encodings

const te = new TextEncoder();
const td = new TextDecoder();

export function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const b64uJson = (value: unknown) => b64u(te.encode(JSON.stringify(value)));
const jsonB64u = (text: string): unknown => JSON.parse(td.decode(fromB64u(text)));

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

// -------------------------------------------------------------------- keys

export interface EcJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  d?: string;
  kid?: string;
  alg?: "ES256";
  use?: "sig";
}

/** RFC 7638 thumbprint: the key's id, derived from the key and nothing else. */
export async function thumbprint(jwk: EcJwk): Promise<string> {
  return b64u(await sha256(te.encode(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }))));
}

export function publicJwk(jwk: EcJwk): EcJwk {
  const { kty, crv, x, y, kid } = jwk;
  return { kty, crv, x, y, kid, alg: "ES256", use: "sig" };
}

/** A new ES256 signing key, its kid set to its thumbprint. */
export async function generateSigningKey(): Promise<EcJwk> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as EcJwk;
  const key: EcJwk = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d };
  return { ...key, kid: await thumbprint(key), alg: "ES256", use: "sig" };
}

const ES256 = { name: "ECDSA", namedCurve: "P-256" } as const;

// --------------------------------------------------------------------- JWS

export interface JwsHeader {
  alg: "ES256";
  typ: string;
  kid: string;
}

export async function signJws(header: JwsHeader, payload: unknown, privateKey: EcJwk): Promise<string> {
  if (!privateKey.d) throw new Error("not a private key");
  const key = await crypto.subtle.importKey("jwk", { ...privateKey, key_ops: ["sign"] } as JsonWebKey, ES256, false, ["sign"]);
  const input = `${b64uJson(header)}.${b64uJson(payload)}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(input));
  return `${input}.${b64u(new Uint8Array(sig))}`;
}

/** Verifies a compact JWS against a key set; throws on anything short of a valid ES256 signature by a known key. */
export async function verifyJws(jws: string, keys: EcJwk[]): Promise<{ header: JwsHeader; payload: Record<string, unknown> }> {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("not a compact JWS");
  const header = jsonB64u(parts[0]) as JwsHeader;
  if (header.alg !== "ES256") throw new Error(`unexpected alg: ${String(header.alg)}`);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error(`unknown key: ${String(header.kid)}`);
  const key = await crypto.subtle.importKey("jwk", { ...publicJwk(jwk), key_ops: ["verify"] } as JsonWebKey, ES256, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" }, key, fromB64u(parts[2]) as BufferSource, te.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new Error("signature does not verify");
  return { header, payload: jsonB64u(parts[1]) as Record<string, unknown> };
}

// ------------------------------------------------------------------ SD-JWT

export interface Disclosure {
  encoded: string;
  salt: string;
  name: string;
  value: unknown;
}

async function digestOf(encoded: string): Promise<string> {
  return b64u(await sha256(te.encode(encoded)));
}

export function makeDisclosure(name: string, value: unknown, salt?: string): Disclosure {
  const s = salt ?? b64u(crypto.getRandomValues(new Uint8Array(16)));
  return { encoded: b64uJson([s, name, value]), salt: s, name, value };
}

export function readDisclosure(encoded: string): Disclosure {
  const d = jsonB64u(encoded);
  if (!Array.isArray(d) || d.length !== 3 || typeof d[0] !== "string" || typeof d[1] !== "string") {
    throw new Error("not an object-property disclosure");
  }
  return { encoded, salt: d[0], name: d[1], value: d[2] };
}

/** `jwt~d1~d2~…~`: the issuer-signed JWT and its disclosures, no key binding. */
export function joinSdJwt(jwt: string, disclosures: string[]): string {
  return [jwt, ...disclosures, ""].join("~");
}

export function splitSdJwt(sdJwt: string): { jwt: string; disclosures: string[] } {
  const parts = sdJwt.split("~");
  if (parts.length < 2 || parts[parts.length - 1] !== "") throw new Error("not an SD-JWT without key binding");
  return { jwt: parts[0], disclosures: parts.slice(1, -1) };
}

/** The same credential, showing only the disclosures whose claim names are kept. */
export function present(sdJwt: string, keep: readonly string[]): string {
  const { jwt, disclosures } = splitSdJwt(sdJwt);
  return joinSdJwt(jwt, disclosures.filter((d) => keep.includes(readDisclosure(d).name)));
}

// -------------------------------------------------------------- credential

export interface MonthInput {
  credentialId: string;
  issuer: string;
  statusListUrl: string;
  statusIndex: number;
  validFrom: string;
  validUntil: string;
  subjectRef: string;
  period: string;
  snapshotVersion: number;
  methodology: string;
  evidenceLevel: "SELF_DECLARED" | "COMMUNITY_ATTESTED" | "EXTERNALLY_VERIFIED";
  dataOrigin: string;
  daysInPeriod: number;
  indicators: Partial<Record<Disclosable, number>>;
}

/** Issues the month's credential: every indicator present becomes a disclosure. */
export async function issueMonth(input: MonthInput, signingKey: EcJwk): Promise<string> {
  if (!signingKey.kid) throw new Error("the signing key has no kid");
  const disclosures = DISCLOSABLE.filter((k) => typeof input.indicators[k] === "number")
    .map((k) => makeDisclosure(k, input.indicators[k]));
  // Sorted, so the order of the digests says nothing about which is which.
  const sd = (await Promise.all(disclosures.map((d) => digestOf(d.encoded)))).sort();
  const payload = {
    "@context": [VC_CONTEXT],
    id: `urn:uuid:${input.credentialId}`,
    type: ["VerifiableCredential", "BusinessActivityCredential"],
    issuer: input.issuer,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    credentialSubject: {
      id: `urn:empowerfi:subject:${input.subjectRef}`,
      period: input.period,
      daysInPeriod: input.daysInPeriod,
      currency: "BRL",
      snapshotVersion: input.snapshotVersion,
      methodology: input.methodology,
      evidenceLevel: input.evidenceLevel,
      dataOrigin: input.dataOrigin,
      _sd: sd,
    },
    credentialStatus: {
      id: `${input.statusListUrl}#${input.statusIndex}`,
      type: "BitstringStatusListEntry",
      statusPurpose: "revocation",
      statusListIndex: String(input.statusIndex),
      statusListCredential: input.statusListUrl,
    },
    _sd_alg: "sha-256",
  };
  const jwt = await signJws({ alg: "ES256", typ: CREDENTIAL_TYP, kid: signingKey.kid }, payload, signingKey);
  return joinSdJwt(jwt, disclosures.map((d) => d.encoded));
}

export interface VerifiedMonth {
  kid: string;
  credential: Record<string, unknown>;
  subject: Record<string, unknown>;
  disclosed: Record<string, unknown>;
  statusListUrl: string;
  statusIndex: number;
  validFrom: string;
  validUntil: string;
}

/**
 * Verifies a presented credential: the issuer's signature, its type, and that
 * every disclosure shown is one the issuer signed. Throws when any fails. It
 * does not check time or status -- see checkMonth.
 */
export async function verifyMonth(presentation: string, keys: EcJwk[]): Promise<VerifiedMonth> {
  const { jwt, disclosures } = splitSdJwt(presentation);
  const { header, payload } = await verifyJws(jwt, keys);
  if (header.typ !== CREDENTIAL_TYP) throw new Error(`unexpected typ: ${String(header.typ)}`);
  if (payload._sd_alg !== "sha-256") throw new Error("unexpected _sd_alg");
  const types = payload.type as unknown;
  if (!Array.isArray(types) || !types.includes("VerifiableCredential") || !types.includes("BusinessActivityCredential")) {
    throw new Error("not a business activity credential");
  }
  const subject = payload.credentialSubject as Record<string, unknown>;
  const signed = new Set((subject?._sd as string[] | undefined) ?? []);
  const disclosed: Record<string, unknown> = {};
  for (const encoded of disclosures) {
    if (!signed.has(await digestOf(encoded))) throw new Error("a disclosure the issuer did not sign");
    const d = readDisclosure(encoded);
    if (d.name in disclosed || d.name in subject) throw new Error(`claim disclosed twice: ${d.name}`);
    disclosed[d.name] = d.value;
  }
  const status = payload.credentialStatus as Record<string, unknown>;
  const { _sd: _, ...visible } = subject;
  return {
    kid: header.kid,
    credential: payload,
    subject: visible,
    disclosed,
    statusListUrl: String(status?.statusListCredential ?? ""),
    statusIndex: Number(status?.statusListIndex),
    validFrom: String(payload.validFrom),
    validUntil: String(payload.validUntil),
  };
}

// ------------------------------------------------------------- status list

async function gzip(bytes: Uint8Array, mode: "gzip" | "gunzip"): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(mode === "gzip" ? new CompressionStream("gzip") : new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Multibase base64url of the gzipped bitstring; index 0 is the first byte's highest bit. */
export async function encodeStatusList(revoked: number[], bits = STATUS_LIST_BITS): Promise<string> {
  const list = new Uint8Array(bits / 8);
  for (const i of revoked) {
    if (!Number.isInteger(i) || i < 0 || i >= bits) throw new Error(`status index out of range: ${i}`);
    list[i >> 3] |= 0x80 >> (i & 7);
  }
  return `u${b64u(await gzip(list, "gzip"))}`;
}

export async function decodeStatusList(encoded: string): Promise<Uint8Array> {
  if (!encoded.startsWith("u")) throw new Error("not multibase base64url");
  return gzip(fromB64u(encoded.slice(1)), "gunzip");
}

export function isRevoked(list: Uint8Array, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= list.length * 8) throw new Error(`status index out of range: ${index}`);
  return (list[index >> 3] & (0x80 >> (index & 7))) !== 0;
}

export async function issueStatusList(
  input: { issuer: string; url: string; validFrom: string; validUntil: string; revoked: number[] },
  signingKey: EcJwk,
): Promise<string> {
  if (!signingKey.kid) throw new Error("the signing key has no kid");
  const payload = {
    "@context": [VC_CONTEXT],
    id: input.url,
    type: ["VerifiableCredential", "BitstringStatusListCredential"],
    issuer: input.issuer,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    credentialSubject: {
      id: `${input.url}#list`,
      type: "BitstringStatusList",
      statusPurpose: "revocation",
      encodedList: await encodeStatusList(input.revoked),
    },
  };
  return signJws({ alg: "ES256", typ: STATUS_LIST_TYP, kid: signingKey.kid }, payload, signingKey);
}

export async function verifyStatusList(jwt: string, keys: EcJwk[], issuer: string): Promise<{ list: Uint8Array; validUntil: string }> {
  const { header, payload } = await verifyJws(jwt, keys);
  if (header.typ !== STATUS_LIST_TYP) throw new Error(`unexpected typ: ${String(header.typ)}`);
  if (payload.issuer !== issuer) throw new Error("status list from another issuer");
  const subject = payload.credentialSubject as Record<string, unknown>;
  if (subject?.statusPurpose !== "revocation") throw new Error("not a revocation list");
  return { list: await decodeStatusList(String(subject.encodedList)), validUntil: String(payload.validUntil) };
}

// ------------------------------------------------------------------ checks

export interface MonthCheck {
  signature: "valid" | "invalid";
  status: "active" | "revoked" | "unknown";
  time: "current" | "expired" | "not_yet_valid";
  month?: VerifiedMonth;
  error?: string;
}

/**
 * Everything a verifier asks of one presented month: signature, status and
 * time, each answered separately, so a page can say which one failed.
 */
export async function checkMonth(
  presentation: string,
  keys: EcJwk[],
  statusList: (url: string) => Promise<Uint8Array>,
  now = new Date(),
): Promise<MonthCheck> {
  let month: VerifiedMonth;
  try {
    month = await verifyMonth(presentation, keys);
  } catch (e) {
    return { signature: "invalid", status: "unknown", time: "expired", error: String((e as Error).message ?? e) };
  }
  let status: MonthCheck["status"] = "unknown";
  try {
    status = isRevoked(await statusList(month.statusListUrl), month.statusIndex) ? "revoked" : "active";
  } catch {
    status = "unknown";
  }
  const t = now.getTime();
  const time = t < Date.parse(month.validFrom) ? "not_yet_valid" : t >= Date.parse(month.validUntil) ? "expired" : "current";
  return { signature: "valid", status, time, month };
}
