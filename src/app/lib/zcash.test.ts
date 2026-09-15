import { describe, expect, it } from "vitest";
import { paymentUri, zec } from "./zcash";

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
