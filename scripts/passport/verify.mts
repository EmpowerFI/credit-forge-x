// Verifies a Business Passport link the way a partner's own system would:
// with none of EmpowerFI's code. The signature is checked by Node's OpenSSL,
// the SD-JWT digests and the status list are read by the code below, written
// from the specifications, not imported from packages/passport.
//
//   npx tsx scripts/passport/verify.mts 'https://<ref>.supabase.co/functions/v1/passport/link/<token>'
//
// Opening the link is recorded as an access, as any opening is.
import { createHash, createPublicKey, verify } from "node:crypto";
import { gunzipSync } from "node:zlib";

const url = process.argv[2];
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
    if (revoked || !current) failures++;
  } catch (e) {
    failures++;
    console.log(`${m.period}: INVALID — ${(e as Error).message}`);
  }
}
process.exit(failures ? 1 : 0);
