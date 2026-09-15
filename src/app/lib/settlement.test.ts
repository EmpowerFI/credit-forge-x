import { describe, expect, it } from "vitest";
import { mockPixE2e, reaisAtRamp } from "./settlement";

describe("settlement", () => {
  it("mock Pix ids have Pix's shape and a fake institution", () => {
    const id = mockPixE2e(new Date(Date.UTC(2026, 8, 15, 18, 7)));
    expect(id).toMatch(/^E99999999202609151807[A-Za-z0-9]{11}$/);
    expect(id).toHaveLength(32);
  });

  it("converts USDC to reais at the quote, less the spread", () => {
    // 100 USDC at R$ 5.40, less 0.50%: R$ 537.30.
    expect(reaisAtRamp(100_000_000, 5400, 50)).toBe(53_730);
    expect(reaisAtRamp(0, 5400, 50)).toBe(0);
  });
});
