// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  b64u, checkMonth, decodeStatusList, encodeStatusList, fromB64u, generateSigningKey, isRevoked, issueMonth,
  issueStatusList, makeDisclosure, type MonthInput, present, publicJwk, readDisclosure, splitSdJwt, thumbprint,
  verifyMonth, verifyStatusList,
} from "./index";

const ISSUER = "https://example.test/functions/v1/passport";
const STATUS = `${ISSUER}/status/1`;

const october: MonthInput = {
  credentialId: "6f1c1a8e-8f43-4c3a-9d55-0d6c1f6c9a01",
  issuer: ISSUER,
  statusListUrl: STATUS,
  statusIndex: 4242,
  validFrom: "2026-11-02T10:00:00Z",
  validUntil: "2027-11-02T10:00:00Z",
  subjectRef: "B-abcdefghij",
  period: "2026-10",
  snapshotVersion: 1,
  methodology: "snapshot-v1.0.0",
  evidenceLevel: "SELF_DECLARED",
  dataOrigin: "whatsapp_journal",
  daysInPeriod: 31,
  indicators: {
    revenue_cents: 465000, business_expenses_cents: 187550, business_balance_cents: 277450, days_kept: 31,
    selling_days: 31, receivable_cents: 0, payable_cents: 0, withdrawals_cents: 50000, financing_cents: 12000,
  },
};

const shared = ["revenue_cents", "business_expenses_cents", "business_balance_cents", "days_kept"];

describe("the signing key", () => {
  it("is ES256, its kid its RFC 7638 thumbprint, and its public half has no d", async () => {
    const key = await generateSigningKey();
    expect(key.kid).toBe(await thumbprint(key));
    expect(key.d).toBeTruthy();
    expect(publicJwk(key)).not.toHaveProperty("d");
    expect(publicJwk(key)).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256", use: "sig" });
  });
});

describe("a month's credential", () => {
  it("carries every indicator as a disclosure and nothing of hers in the clear", async () => {
    const key = await generateSigningKey();
    const sdJwt = await issueMonth(october, key);
    const { jwt, disclosures } = splitSdJwt(sdJwt);
    expect(disclosures).toHaveLength(9);
    const body = new TextDecoder().decode(fromB64u(jwt.split(".")[1]));
    expect(body).not.toContain("465000");
    expect(body).toContain("B-abcdefghij");
    const header = JSON.parse(new TextDecoder().decode(fromB64u(jwt.split(".")[0])));
    expect(header).toEqual({ alg: "ES256", typ: "vc+sd-jwt", kid: key.kid });
  });

  it("presented under a share, shows only what she authorised, and verifies", async () => {
    const key = await generateSigningKey();
    const shown = present(await issueMonth(october, key), shared);
    const m = await verifyMonth(shown, [publicJwk(key)]);
    expect(m.disclosed).toEqual({ revenue_cents: 465000, business_expenses_cents: 187550, business_balance_cents: 277450, days_kept: 31 });
    expect(m.subject).toMatchObject({ period: "2026-10", daysInPeriod: 31, evidenceLevel: "SELF_DECLARED", snapshotVersion: 1 });
    expect(m.statusIndex).toBe(4242);
    expect(m.statusListUrl).toBe(STATUS);
  });

  it("refuses a changed figure, a forged disclosure, a changed body, another key", async () => {
    const key = await generateSigningKey();
    const other = await generateSigningKey();
    const sdJwt = await issueMonth(october, key);
    const { jwt, disclosures } = splitSdJwt(sdJwt);
    const keys = [publicJwk(key)];

    const revenue = disclosures.find((d) => readDisclosure(d).name === "revenue_cents")!;
    const d = readDisclosure(revenue);
    const inflated = makeDisclosure("revenue_cents", 9_900_000, d.salt).encoded;
    await expect(verifyMonth(`${jwt}~${inflated}~`, keys)).rejects.toThrow("did not sign");

    const [h, p, s] = jwt.split(".");
    const body = JSON.parse(new TextDecoder().decode(fromB64u(p)));
    body.credentialSubject.evidenceLevel = "EXTERNALLY_VERIFIED";
    const forged = `${h}.${b64u(new TextEncoder().encode(JSON.stringify(body)))}.${s}`;
    await expect(verifyMonth(`${forged}~`, keys)).rejects.toThrow("does not verify");

    await expect(verifyMonth(sdJwt, [{ ...publicJwk(other), kid: key.kid }])).rejects.toThrow("does not verify");
    await expect(verifyMonth(sdJwt, [publicJwk(other)])).rejects.toThrow("unknown key");
    await expect(verifyMonth(`${jwt}~${revenue}~${revenue}~`, keys)).rejects.toThrow("twice");
  });
});

describe("the status list", () => {
  it("round-trips at the W3C minimum size, index 0 the first byte's highest bit", async () => {
    const encoded = await encodeStatusList([0, 7, 4242, 131071]);
    const list = await decodeStatusList(encoded);
    expect(list).toHaveLength(16384);
    expect(list[0]).toBe(0b1000_0001);
    for (const i of [0, 7, 4242, 131071]) expect(isRevoked(list, i)).toBe(true);
    for (const i of [1, 4241, 4243]) expect(isRevoked(list, i)).toBe(false);
    expect(encoded.startsWith("u")).toBe(true);
  });

  it("tells a corrected month from a current one", async () => {
    const key = await generateSigningKey();
    const keys = [publicJwk(key)];
    const shown = present(await issueMonth(october, key), shared);
    const lists: Record<string, string> = {};
    const fetchList = async (url: string) => (await verifyStatusList(lists[url], keys, ISSUER)).list;
    const at = new Date("2026-12-01T00:00:00Z");

    lists[STATUS] = await issueStatusList({ issuer: ISSUER, url: STATUS, validFrom: at.toISOString(), validUntil: "2026-12-02T00:00:00Z", revoked: [] }, key);
    expect(await checkMonth(shown, keys, fetchList, at)).toMatchObject({ signature: "valid", status: "active", time: "current" });

    lists[STATUS] = await issueStatusList({ issuer: ISSUER, url: STATUS, validFrom: at.toISOString(), validUntil: "2026-12-02T00:00:00Z", revoked: [4242] }, key);
    expect(await checkMonth(shown, keys, fetchList, at)).toMatchObject({ signature: "valid", status: "revoked" });

    expect(await checkMonth(shown, keys, fetchList, new Date("2028-01-01T00:00:00Z"))).toMatchObject({ time: "expired" });
    expect((await checkMonth(`x${shown}`, keys, fetchList, at)).signature).toBe("invalid");
  });

  it("refuses a list signed for another issuer", async () => {
    const key = await generateSigningKey();
    const jwt = await issueStatusList({ issuer: "https://elsewhere.test", url: STATUS, validFrom: "2026-12-01T00:00:00Z", validUntil: "2026-12-02T00:00:00Z", revoked: [] }, key);
    await expect(verifyStatusList(jwt, [publicJwk(key)], ISSUER)).rejects.toThrow("another issuer");
  });
});
