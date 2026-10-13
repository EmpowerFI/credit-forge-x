import { describe, expect, it } from "vitest";
import { computeInsights, INSIGHTS_FORMULA_VERSION, type MonthFigures } from "./index";

const month = (over: Partial<MonthFigures> = {}): MonthFigures => ({
  period: "2026-10",
  revenue_cents: 345_000,
  cogs_cents: 120_000,
  opex_cents: 30_000,
  household_cents: 90_000,
  keeps_records: true,
  active_days: 22,
  ...over,
});

describe("a complete month", () => {
  it("computes cost, result and margin as integers", () => {
    const r = computeInsights({ current: month() });
    expect(r.formula_version).toBe(INSIGHTS_FORMULA_VERSION);
    expect(r.business_cost_cents).toBe(150_000);
    expect(r.result_cents).toBe(195_000);
    expect(r.result_is_estimated).toBe(false);
    // 195000 / 345000 = 56.52% → 5652 bps, rounded.
    expect(r.margin_bps).toBe(5652);
    expect(r.data_quality).toBe("complete");
    expect(r.flags).toEqual([]);
  });
});

describe("never invents a number", () => {
  it("a cost she did not know leaves the result null, not zero", () => {
    const r = computeInsights({ current: month({ cogs_cents: null }) });
    expect(r.business_cost_cents).toBeNull();
    expect(r.result_cents).toBeNull(); // not 345000 − 30000; the cost is unknown, so is the result
    expect(r.margin_bps).toBeNull();
    expect(r.result_is_estimated).toBe(false); // absent, not estimated
    expect(r.data_quality).toBe("incomplete");
    expect(r.flags).toContain("COST_UNKNOWN");
  });

  it("both costs unknown is still a report, just without a result", () => {
    const r = computeInsights({ current: month({ cogs_cents: null, opex_cents: null }) });
    expect(r.result_cents).toBeNull();
    expect(r.revenue_cents).toBe(345_000); // what she does know is still there
  });
});

describe("estimated vs recorded", () => {
  it("no records means the result stands but is marked estimated", () => {
    const r = computeInsights({ current: month({ keeps_records: false }) });
    expect(r.result_cents).toBe(195_000); // computable: the categories are known
    expect(r.result_is_estimated).toBe(true);
    expect(r.data_quality).toBe("estimated");
    expect(r.flags).toContain("FIGURES_ESTIMATED");
  });

  it("a null result is never called estimated", () => {
    const r = computeInsights({ current: month({ keeps_records: false, opex_cents: null }) });
    expect(r.result_cents).toBeNull();
    expect(r.result_is_estimated).toBe(false);
    expect(r.flags).not.toContain("FIGURES_ESTIMATED");
  });
});

describe("the hard months, reported as facts not verdicts", () => {
  it("cost above revenue is a negative result, flagged plainly", () => {
    const r = computeInsights({ current: month({ revenue_cents: 100_000, cogs_cents: 90_000, opex_cents: 40_000 }) });
    expect(r.result_cents).toBe(-30_000);
    expect(r.margin_bps).toBe(-3000);
    expect(r.flags).toContain("RESULT_NEGATIVE");
  });

  it("drawing more for the home than the business made", () => {
    const r = computeInsights({ current: month({ household_cents: 300_000 }) }); // result is 195000
    expect(r.flags).toContain("HOUSEHOLD_OVER_RESULT");
  });

  it("a household draw larger than all sales signals mixed money", () => {
    const r = computeInsights({ current: month({ revenue_cents: 80_000, cogs_cents: 10_000, opex_cents: 5_000, household_cents: 120_000 }) });
    expect(r.flags).toContain("HOUSEHOLD_OVER_REVENUE");
  });

  it("no sales at all", () => {
    const r = computeInsights({ current: month({ revenue_cents: 0, cogs_cents: 0, opex_cents: 0, household_cents: 0 }) });
    expect(r.flags).toContain("REVENUE_ZERO");
    expect(r.margin_bps).toBeNull(); // no revenue to divide by, even though result is 0
  });

  it("very few active days", () => {
    expect(computeInsights({ current: month({ active_days: 3 }) }).flags).toContain("FEW_ACTIVE_DAYS");
    expect(computeInsights({ current: month({ active_days: 5 }) }).flags).not.toContain("FEW_ACTIVE_DAYS");
  });
});

describe("the comparison, only against the month before", () => {
  it("a material rise and fall are flagged with the change in bps", () => {
    const up = computeInsights({ current: month({ revenue_cents: 400_000 }), previous: month({ period: "2026-09", revenue_cents: 300_000 }) });
    expect(up.previous_period).toBe("2026-09");
    expect(up.revenue_change_bps).toBe(3333); // +33.3%
    expect(up.flags).toContain("REVENUE_UP");

    const down = computeInsights({ current: month({ revenue_cents: 200_000 }), previous: month({ period: "2026-09", revenue_cents: 300_000 }) });
    expect(down.revenue_change_bps).toBe(-3333);
    expect(down.flags).toContain("REVENUE_DOWN");
  });

  it("a small change is noise, not a trend", () => {
    const r = computeInsights({ current: month({ revenue_cents: 345_000 }), previous: month({ period: "2026-09", revenue_cents: 330_000 }) });
    expect(r.revenue_change_bps).toBe(455); // +4.5%, under the 15% threshold
    expect(r.flags).not.toContain("REVENUE_UP");
  });

  it("a non-adjacent month is not a comparison", () => {
    const r = computeInsights({ current: month({ period: "2026-10" }), previous: month({ period: "2026-03", revenue_cents: 100_000 }) });
    expect(r.previous_period).toBeNull();
    expect(r.revenue_change_bps).toBeNull();
  });

  it("no previous month at all", () => {
    const r = computeInsights({ current: month() });
    expect(r.revenue_change_bps).toBeNull();
    expect(r.revenue_prev_cents).toBeNull();
  });

  it("a previous month of zero revenue yields no percentage", () => {
    const r = computeInsights({ current: month({ revenue_cents: 50_000 }), previous: month({ period: "2026-09", revenue_cents: 0 }) });
    expect(r.previous_period).toBe("2026-09"); // the comparison exists
    expect(r.revenue_change_bps).toBeNull(); // but dividing by zero does not
  });
});

describe("refuses inputs that are not figures", () => {
  it("a bad period, a negative amount, an impossible day count", () => {
    expect(() => computeInsights({ current: month({ period: "2026-13" }) })).toThrow();
    expect(() => computeInsights({ current: month({ revenue_cents: -1 }) })).toThrow();
    expect(() => computeInsights({ current: month({ active_days: 40 }) })).toThrow();
    expect(() => computeInsights({ current: month({ revenue_cents: 1.5 }) })).toThrow();
  });
});
