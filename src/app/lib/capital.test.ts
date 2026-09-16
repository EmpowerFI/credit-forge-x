import { describe, expect, it } from "vitest";
import { bpsPercent, poolOf, positionReais, PROTOTYPE_NOTICE, REASON, reaisShort, usdcShort } from "./capital";

describe("capital", () => {
  it("reads hero figures the way the specification shows them", () => {
    expect(reaisShort(12_630_000)).toBe("R$ 126.3k");
    expect(reaisShort(4_850_000)).toBe("R$ 48.5k");
    expect(reaisShort(95_000)).toBe("R$ 950");
    expect(usdcShort(18_240_000_000)).toBe("18.2k USDC");
    expect(bpsPercent(3_800)).toBe("38%");
    expect(bpsPercent(9_650)).toBe("96.5%");
  });

  it("keeps a domestic position's reais, or reads them at the quote", () => {
    expect(positionReais(150_000, 277_777_778, 5400)).toBe(150_000);
    expect(positionReais(null, 370_370_370, 5400)).toBe(199_999);
    expect(positionReais(null, 1, null)).toBeNull();
  });

  it("knows only the two pools", () => {
    expect(poolOf("domestic")).toBe("domestic");
    expect(poolOf("global")).toBe("global");
    expect(poolOf("brl_stablecoin")).toBeNull();
    expect(poolOf(null)).toBeNull();
  });

  it("explains every reason code the engine can give", () => {
    expect(Object.keys(REASON)).toHaveLength(13);
    for (const r of Object.values(REASON)) expect(r.says.length).toBeGreaterThan(20);
  });

  it("carries the required disclaimer word for word", () => {
    expect(PROTOTYPE_NOTICE).toBe(
      "Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.",
    );
  });
});
