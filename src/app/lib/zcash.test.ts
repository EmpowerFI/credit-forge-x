import { describe, expect, it } from "vitest";
import { batchLine, isShieldedTestAddress, paymentUri, zec, type BatchOf } from "./zcash";

describe("zcash", () => {
  it("builds the same ZIP 321 URI as the zcash-request function", () => {
    // The vector in platform/supabase/functions/_shared/zcash.test.ts.
    expect(paymentUri({ address: "utest1abc", amount_zat: 876_000, memo: "EmpowerFI allocation EFI-ABCDEFGHJK", ref: "EFI-ABCDEFGHJK" })).toBe(
      "zcash:utest1abc?amount=0.00876&memo=RW1wb3dlckZJIGFsbG9jYXRpb24gRUZJLUFCQ0RFRkdISks&message=EmpowerFI%20EFI-ABCDEFGHJK",
    );
  });

  it("reads amounts as testnet ZEC without trailing zeros", () => {
    expect(zec(177_000)).toBe("0.00177 TAZ");
    expect(zec(100_000_000)).toBe("1 TAZ");
    expect(zec(10_000_000, "main")).toBe("0.1 ZEC");
    expect(zec(null)).toBe("—");
  });
});

describe("a return address", () => {
  it("is a shielded testnet address: unified or Sapling, any case, trimmed", () => {
    expect(isShieldedTestAddress(`utest1${"q".repeat(80)}`)).toBe(true);
    expect(isShieldedTestAddress(`  ZTESTSAPLING1${"X".repeat(70)} `)).toBe(true);
  });
  it("never transparent, mainnet, or outside bech32's alphabet", () => {
    expect(isShieldedTestAddress("tmBsTi2xWTjUdEXnuTceL7fecEQKeWaPDJd")).toBe(false);
    expect(isShieldedTestAddress(`u1${"q".repeat(80)}`)).toBe(false);
    expect(isShieldedTestAddress(`utest1${"b".repeat(80)}`)).toBe(false);
    expect(isShieldedTestAddress("utest1short")).toBe(false);
  });
});

/**
 * The sentence a batch earns. Its whole job is to claim no more than the two
 * counts support, so these cases are the claim itself: positions blend the
 * individual amounts, investors blend the totals, and the two are not the same
 * number. Overstating an anonymity set is the first thing a reader who knows
 * privacy checks, which makes this the test that matters most in the file.
 */
const batch = (over: Partial<BatchOf> = {}): BatchOf => ({
  status: "credited",
  members: 4,
  investors: 4,
  credited_micro_usdc: 40_000_000,
  unit_micro_usdc: 10_000_000,
  signature: "sig-batch",
  ...over,
});

describe("batchLine", () => {
  it("names the other investors when there are any", () => {
    const said = batchLine(batch());
    expect(said).toMatch(/3 other investors/);
    expect(said).toMatch(/40\.00 USDC/);
    expect(said).toMatch(/neither your position nor your total/);
  });

  it("counts investors, not payments: four positions from one investor is not a crowd", () => {
    const said = batchLine(batch({ members: 4, investors: 1 }));
    expect(said).not.toMatch(/other investor/);
    expect(said).toMatch(/4 of your positions/);
    // The half that would be a lie if it were left out.
    expect(said).toMatch(/the movement itself is yours/);
  });

  it("says a batch of one hides nothing", () => {
    const said = batchLine(batch({ members: 1, investors: 1 }));
    expect(said).toMatch(/hides nothing/);
    expect(said).toMatch(/a batch of one is not a crowd/);
  });

  it("explains an empty batch as the vault waiting, not the position missing", () => {
    const said = batchLine(batch({ credited_micro_usdc: 0 }));
    expect(said).toMatch(/under one unit of 10\.00 USDC/);
    expect(said).toMatch(/Your position is booked/);
    expect(said).not.toMatch(/movement of/);
  });

  it("agrees with itself about one other investor", () => {
    expect(batchLine(batch({ members: 2, investors: 2 }))).toMatch(/1 other investor,/);
  });
});
