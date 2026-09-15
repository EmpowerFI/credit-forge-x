// @vitest-environment node
import { describe, expect, it } from "vitest";
import golden from "../vectors/golden.json";
import {
  CanonicalizationError,
  DOMAINS,
  canonicalize,
  commit,
  fromHex,
  hashAllocationRef,
  hashBorrowerRef,
  randomRef,
  sameCommitment,
  toHex,
  type CanonicalObject,
  type Domain,
} from "./index.ts";

// The expected values come from vectors/generate.py — an independent Python
// implementation — so these tests check this module against something other
// than itself. Deno runs the same vectors against the same module.

describe("golden vectors", () => {
  for (const v of golden.commitments) {
    it(`canonical form: ${v.name}`, () => {
      expect(canonicalize(v.payload as CanonicalObject)).toBe(v.canonical);
    });

    it(`commitment: ${v.name}`, async () => {
      const hash = await commit(v.domain as Domain, v.payload as CanonicalObject);
      expect(toHex(hash)).toBe(v.commitment);
    });
  }

  for (const v of golden.borrower_ref_hashes) {
    it(`borrower ref hash: ${v.name}`, async () => {
      expect(toHex(await hashBorrowerRef(fromHex(v.borrower_ref)))).toBe(v.hash);
    });
  }
  for (const v of golden.allocation_ref_hashes) {
    it(`allocation ref hash: ${v.name}`, async () => {
      expect(toHex(await hashAllocationRef(fromHex(v.allocation_ref)))).toBe(v.hash);
    });
  }
});

describe("canonicalize", () => {
  it("ignores the order keys were written in", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("rejects floats, so money cannot have two renderings", () => {
    expect(() => canonicalize({ amount: 10.5 })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ amount: Number.NaN })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ amount: 2 ** 53 })).toThrow(CanonicalizationError);
  });

  it("rejects undefined rather than dropping the key", () => {
    expect(() => canonicalize({ a: undefined } as unknown as CanonicalObject)).toThrow(/\.a/);
  });

  it("rejects values that are not plain JSON", () => {
    expect(() => canonicalize({ at: new Date(0) } as unknown as CanonicalObject)).toThrow(CanonicalizationError);
    expect(() => canonicalize({ n: 1n } as unknown as CanonicalObject)).toThrow(CanonicalizationError);
  });
});

describe("commit", () => {
  it("separates domains: the same payload under two tags gives two hashes", async () => {
    const payload = { id: "x", value: 1 };
    const checkin = await commit(DOMAINS.CHECKIN, payload);
    const readiness = await commit(DOMAINS.READINESS, payload);
    expect(sameCommitment(checkin, readiness)).toBe(false);
  });

  it("changes when any field changes", async () => {
    const a = await commit(DOMAINS.COMMUNITY, { name: "A", verified: false });
    const b = await commit(DOMAINS.COMMUNITY, { name: "A", verified: true });
    expect(sameCommitment(a, b)).toBe(false);
  });

  it("is 32 bytes, as the program expects", async () => {
    expect((await commit(DOMAINS.LOAN, {})).length).toBe(32);
  });
});

describe("refs and hex", () => {
  it("generates 32 random bytes that differ between calls", () => {
    const a = randomRef();
    expect(a.length).toBe(32);
    expect(sameCommitment(a, randomRef())).toBe(false);
  });

  it("refuses a borrower ref of the wrong length", async () => {
    await expect(hashBorrowerRef(new Uint8Array(16))).rejects.toThrow(/32 bytes/);
  });

  it("round-trips hex, including Postgres bytea output", () => {
    const bytes = new Uint8Array([0, 1, 171, 255]);
    expect(toHex(bytes)).toBe("0001abff");
    expect(fromHex("0001abff")).toEqual(bytes);
    expect(fromHex("\\x0001abff")).toEqual(bytes);
    expect(() => fromHex("zz")).toThrow();
  });
});
