import { describe, expect, it } from "vitest";
import { isShieldedTestAddress, paymentUri, zec } from "./zcash";

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
