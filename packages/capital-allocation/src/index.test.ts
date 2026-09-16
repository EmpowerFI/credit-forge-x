// @vitest-environment node
import { describe, expect, it } from "vitest";
import vectors from "../vectors/scenarios.json";
import {
  allocate, allocatePortfolio, CAPITAL_ALLOCATION_MODEL_VERSION, usdcToCents,
  type AllocationOpportunity, type PoolPolicy,
} from "./index.ts";

// Expectations in vectors/scenarios.json were reasoned from the rules by hand.
// The database's private.allocate_funding is held to the same scenarios.

const DOMESTIC = vectors.pools.domestic as PoolPolicy;
const GLOBAL = vectors.pools.global as PoolPolicy;

type Scenario = (typeof vectors.scenarios)[number] & {
  input: { opportunity: AllocationOpportunity; domestic?: Partial<PoolPolicy>; global?: Partial<PoolPolicy> };
};

const run = (s: Scenario) => allocate(s.input.opportunity, { ...DOMESTIC, ...s.input.domestic }, { ...GLOBAL, ...s.input.global });

describe("scenarios", () => {
  it("are written for this model version", () => expect(vectors.model_version).toBe(CAPITAL_ALLOCATION_MODEL_VERSION));
  for (const s of vectors.scenarios as Scenario[]) {
    it(s.name, () => {
      const r = run(s);
      const { domestic_all_in_bps, global_all_in_bps, ...rest } = s.expect;
      expect(r.domestic.all_in_bps, "domestic all-in").toBe(domestic_all_in_bps);
      expect(r.global.all_in_bps, "global all-in").toBe(global_all_in_bps);
      for (const [field, value] of Object.entries(rest)) expect(r[field as keyof typeof r], field).toEqual(value);
    });
  }
});

describe("properties", () => {
  const scenarios = vectors.scenarios as Scenario[];

  it("chooses only a pool that can take the opportunity", () => {
    for (const s of scenarios) {
      const r = run(s);
      if (r.pool) expect(r[r.pool].feasible).toBe(true);
      else expect(r.domestic.feasible || r.global.feasible).toBe(false);
    }
  });

  it("never chooses the dearer pool when both can take it", () => {
    for (const s of scenarios) {
      const r = run(s);
      if (r.domestic.feasible && r.global.feasible) {
        expect(r[r.pool!].all_in_bps).toBe(Math.min(r.domestic.all_in_bps, r.global.all_in_bps));
      }
    }
  });

  it("gives every result at least one reason, with no repeats", () => {
    for (const s of scenarios) {
      const codes = run(s).reason_codes;
      expect(codes.length).toBeGreaterThan(0);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it("rejects amounts and terms that are not positive integers", () => {
    const o = scenarios[0].input.opportunity;
    expect(() => allocate({ ...o, amount_cents: 0 }, DOMESTIC, GLOBAL)).toThrow();
    expect(() => allocate({ ...o, term_months: 1.5 }, DOMESTIC, GLOBAL)).toThrow();
  });
});

describe("portfolio", () => {
  const opp = (amount_cents: number, term_months: number, risk_band: "LOW" | "MEDIUM"): AllocationOpportunity =>
    ({ amount_cents, term_months, risk_band, purpose: "inventory", impact_eligible: true });

  it("draws each pool down in order, and shows what domestic capital alone would cover", () => {
    // A: domestic, cheaper at six months. B: global, cheaper at twelve.
    // C: domestic has R$ 2,000 left for R$ 3,000, so global takes it.
    const p = allocatePortfolio(
      [opp(300_000, 6, "LOW"), opp(300_000, 12, "MEDIUM"), opp(300_000, 6, "LOW")],
      { ...DOMESTIC, available_cents: 500_000 },
      { ...GLOBAL, available_cents: 1_000_000 },
    );
    expect(p.results.map((r) => r.pool)).toEqual(["domestic", "global", "global"]);
    expect(p.results[2].reason_codes).toContain("DOMESTIC_POOL_EXHAUSTED");
    expect(p.demand_cents).toBe(900_000);
    // Alone, domestic funds A; B and C need R$ 3,000 of the R$ 2,000 left.
    expect(p.domestic_only_cents).toBe(300_000);
    expect(p.domestic_coverage_bps).toBe(3333);
    expect(p.combined_cents).toBe(900_000);
    expect(p.combined_coverage_bps).toBe(10_000);
    expect(p.domestic_left_cents).toBe(200_000);
    expect(p.global_left_cents).toBe(400_000);
  });

  it("covers nothing when there is no demand", () => {
    const p = allocatePortfolio([], DOMESTIC, GLOBAL);
    expect(p.domestic_coverage_bps).toBe(0);
    expect(p.combined_coverage_bps).toBe(0);
  });
});

it("converts USDC to reais at the quote, down to the centavo", () => {
  // 18,240 USDC at R$ 5.40: R$ 98,496.00.
  expect(usdcToCents(18_240_000_000, 5400)).toBe(9_849_600);
  expect(usdcToCents(1, 5400)).toBe(0);
});
