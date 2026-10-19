// Verifies a Business Passport link the way a partner's own system would:
// with none of EmpowerFI's code. The signature is checked by Node's OpenSSL,
// the SD-JWT digests and the status list are read by the code below, written
// from the specifications, not imported from packages/passport.
//
//   npx tsx scripts/passport/verify.mts 'https://<ref>.supabase.co/functions/v1/passport/link/<token>' [solana rpc url]
//
// Each month's anchor, when it has one, is checked too: the credential's leaf
// up the RFC 9162 path to the batch root, and that root in a Memo, signed by
// the anchoring authority, in the transaction the proof names -- read from
// Solana directly (default: public devnet).
//
// Opening the link is recorded as an access, as any opening is.
import { createHash, createPublicKey, verify } from "node:crypto";
import { gunzipSync } from "node:zlib";

const url = process.argv[2];
const solanaRpc = process.argv[3] ?? "https://api.devnet.solana.com";
if (!url) {
  console.error("usage: npx tsx scripts/passport/verify.mts <link url>");
  process.exit(2);
}

const b64u = (s: string) => Buffer.from(s, "base64url");
const part = (jwt: string, i: number) => JSON.parse(b64u(jwt.split(".")[i]).toString("utf8"));

async function get(u: string): Promise<Response> {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${u}: HTTP ${r.status} ${await r.text()}`);
  return r;
}

function checkJws(jwt: string, keys: Record<string, unknown>[]): Record<string, unknown> {
  const [h, p, s] = jwt.split(".");
  const header = part(jwt, 0);
  if (header.alg !== "ES256") throw new Error(`alg ${header.alg}`);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error(`unknown kid ${header.kid}`);
  const key = createPublicKey({ key: jwk as never, format: "jwk" });
  const ok = verify("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }, b64u(s));
  if (!ok) throw new Error("signature does not verify");
  return { header, payload: part(jwt, 1) };
}

const link = await (await get(url)).json();
if (link.status !== "live") {
  console.log(`link: ${link.status}`);
  process.exit(1);
}
const { keys } = await (await get(link.jwks)).json();
const anchoring = await (await get(link.anchoring)).json();

const sha = (...parts: (Buffer | number[])[]) => createHash("sha256").update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest();

// RFC 9162 §2.1.3.2, written out again here.
function included(leaf: Buffer, index: number, size: number, path: Buffer[], root: Buffer): boolean {
  if (index >= size) return false;
  let fn = index, sn = size - 1, r = leaf;
  for (const p of path) {
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      r = sha([1], p, r);
      if (fn % 2 === 0) while (fn % 2 === 0 && fn !== 0) { fn >>= 1; sn >>= 1; }
    } else {
      r = sha([1], r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && r.equals(root);
}

async function anchored(jwt: string, a: Record<string, any>): Promise<string> {
  const commitment = sha(Buffer.from("EMPOWERFI:PASSPORT_CREDENTIAL:v1"), [0], Buffer.from(jwt));
  if (!included(sha([0], commitment), a.index, a.size, a.proof.map((h: string) => Buffer.from(h, "hex")), Buffer.from(a.root, "hex"))) {
    throw new Error("not in the batch its proof names");
  }
  const res = await fetch(solanaRpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [a.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }),
  });
  const tx = (await res.json()).result;
  if (!tx || tx.meta?.err) throw new Error("batch transaction not found on chain, or failed");
  const memo = `EMPOWERFI:PASSPORT_BATCH:v1:${a.batch_no}:${a.size}:${a.root}`;
  const ix = tx.transaction.message.instructions.find((i: any) => i.programId === anchoring.memo_program);
  if (!ix || ix.parsed !== memo) throw new Error("the transaction's memo is not this batch");
  const signed = tx.transaction.message.accountKeys.some((k: any) => k.pubkey === anchoring.authority && k.signer);
  if (!signed) throw new Error("not signed by the anchoring authority");
  return `anchored in batch ${a.batch_no} at ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : `slot ${tx.slot}`}`;
}
const lists = new Map<string, Buffer>();

console.log(`issuer:    ${link.issuer}`);
console.log(`recipient: ${link.share.recipient} — ${link.share.purpose_text}`);
console.log(`subject:   ${link.share.subject_ref}, until ${link.share.expires_at}\n`);

let failures = 0;
for (const m of link.months) {
  const [jwt, ...rest] = String(m.presentation).split("~");
  const disclosures = rest.slice(0, -1);
  try {
    const { header, payload } = checkJws(jwt, keys) as { header: Record<string, unknown>; payload: Record<string, any> };
    if (header.typ !== "vc+sd-jwt") throw new Error(`typ ${header.typ}`);
    const subject = payload.credentialSubject;
    const signed = new Set<string>(subject._sd);
    const shown: Record<string, unknown> = {};
    for (const d of disclosures) {
      const digest = createHash("sha256").update(d, "ascii").digest("base64url");
      if (!signed.has(digest)) throw new Error("a disclosure the issuer did not sign");
      const [, name, value] = JSON.parse(b64u(d).toString("utf8"));
      shown[name] = value;
    }

    const status = payload.credentialStatus;
    if (!lists.has(status.statusListCredential)) {
      const listJwt = await (await get(status.statusListCredential)).text();
      const { payload: lp } = checkJws(listJwt, keys) as { payload: Record<string, any> };
      if (lp.issuer !== payload.issuer) throw new Error("status list from another issuer");
      lists.set(status.statusListCredential, gunzipSync(b64u(String(lp.credentialSubject.encodedList).slice(1))));
    }
    const bits = lists.get(status.statusListCredential)!;
    const i = Number(status.statusListIndex);
    const revoked = (bits[i >> 3] & (0x80 >> (i & 7))) !== 0;
    const now = Date.now();
    const current = now >= Date.parse(payload.validFrom) && now < Date.parse(payload.validUntil);

    console.log(`${subject.period} v${subject.snapshotVersion}: signature valid, ${revoked ? "REVOKED" : "active"}, ${current ? "current" : "EXPIRED"}, ${subject.evidenceLevel}`);
    console.log(`  ${JSON.stringify(shown)}`);
    console.log(`  ${m.anchor ? await anchored(jwt, m.anchor) : "not anchored yet (the next daily batch)"}`);
    if (revoked || !current) failures++;
  } catch (e) {
    failures++;
    console.log(`${m.period}: INVALID — ${(e as Error).message}`);
  }
}
process.exit(failures ? 1 : 0);
