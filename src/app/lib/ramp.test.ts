import { describe, expect, it } from "vitest";
import { inRampRange, rampFeeBps, receivedAfterTax } from "./ramp";

describe("ramp", () => {
  it("quotes only what the sandbox prices: $2 to $200", () => {
    expect(inRampRange(1_999_999)).toBe(false);
    expect(inRampRange(2_000_000)).toBe(true);
    expect(inRampRange(200_000_000)).toBe(true);
    expect(inRampRange(200_000_001)).toBe(false);
  });

  it("reads the fee as a share of what was sent", () => {
    // 3.96 USDC on 100: 3.96%.
    expect(rampFeeBps({ fee_micro_usdc: 3_960_000, send_micro_usdc: 100_000_000 })).toBe(396);
    expect(rampFeeBps({ fee_micro_usdc: 3_000_000, send_micro_usdc: 5_000_000 })).toBe(6_000);
    expect(rampFeeBps({ fee_micro_usdc: 0, send_micro_usdc: 0 })).toBe(0);
  });

  it("takes the tax off what MoneyGram delivers", () => {
    // R$ 484.46 less 0.38%: R$ 1.84 of tax, R$ 482.62 to her.
    expect(receivedAfterTax(48_446, 0.38)).toEqual({ tax_cents: 184, net_cents: 48_262 });
    expect(receivedAfterTax(100, 200)).toEqual({ tax_cents: 200, net_cents: 0 });
  });
});
