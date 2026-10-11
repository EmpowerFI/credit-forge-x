// Vectors for the v0.2.0 engine. Reasoned by hand, not recorded from a run.
//
// The load-bearing one is `v1 and v2 agree`: v2 duplicates eighty lines of
// v1's arithmetic because index.ts cannot be refactored under the freeze, and
// the only thing stopping that copy drifting is a test that compares them.

import { describe, expect, it } from "vitest";
import { assessReadiness, type CheckinRecord, type ReadinessRawInput } from "./index";
import { assessReadinessV2, demonstratesPreparation, computeFeaturesV2, type ReadinessRawInputV2 } from "./v2";

const AS_OF = "2026-09";
const PERIODS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const REVENUES = [300_000, 310_000, 320_000, 330_000, 340_000, 350_000];

/** Six unbroken months of a small, steady, mildly growing business. */
function months(opts: { count?: number; recordsKeptFrom?: number } = {}): CheckinRecord[] {
  const count = opts.count ?? 6;
  // Keep the most recent `count` months, so the run always ends at as_of.
  const from = 6 - count;
  return PERIODS.slice(from).map((period, i) => ({
    period,
    revenue_cents: REVENUES[from + i],
    cogs_cents: 100_000,
    opex_cents: 50_000,
    household_cents: 50_000,
    keeps_records: opts.recordsKeptFrom === undefined ? true : i >= opts.recordsKeptFrom,
    active_days: 25,
  }));
}

const raw = (over: Partial<ReadinessRawInputV2> = {}): ReadinessRawInputV2 => ({
  as_of_period: AS_OF,
  community_verified: true,
  core_modules_total: 12,
  core_modules_completed: 12,
  equivalent_modules_total: 0,
  equivalent_modules_completed: 0,
  checkins: months(),
  ...over,
});

describe("v1 and v2 agree wherever preparation is not the question", () => {
  // Inputs with no community programme and no demonstration, so v2's only
  // live route is the core one -- exactly v1's rule under a new name.
  const cases: Array<[string, Partial<ReadinessRawInputV2>]> = [
    ["core complete, but one month unrecorded so nothing is demonstrated", { checkins: months({ recordsKeptFrom: 1 }) }],
    ["core half done", { core_modules_completed: 6, checkins: months({ recordsKeptFrom: 1 }) }],
    ["core untouched", { core_modules_completed: 0, checkins: months({ recordsKeptFrom: 1 }) }],
    ["community unverified", { community_verified: false, checkins: months({ recordsKeptFrom: 1 }) }],
    ["three months only", { checkins: months({ count: 3, recordsKeptFrom: 1 }) }],
    ["no history at all", { checkins: [] }],
  ];

  for (const [name, over] of cases) {
    it(name, () => {
      const input = raw(over);
      const v1 = assessReadiness(input as ReadinessRawInput);
      const v2 = assessReadinessV2(input);

      expect(demonstratesPreparation(computeFeaturesV2(input))).toBe(false);
      expect(v2.result.status).toBe(v1.result.status);
      expect(v2.result.band).toBe(v1.result.band);
      expect(v2.result.score).toBe(v1.result.score);
      expect(v2.result.components).toEqual(v1.result.components);
      expect(v2.result.reason_codes).toEqual(v1.result.reason_codes);
      // The same requirements in the same order, under the renamed code.
      expect(v2.result.missing_requirements).toEqual(
        v1.result.missing_requirements.map((m) =>
          m.code === "CORE_EDUCATION_INCOMPLETE" ? { ...m, code: "PREPARATION_NOT_EVIDENCED" } : m,
        ),
      );
      expect(v2.result.model_version).toBe("readiness-v0.2.0");
    });
  }
});

describe("the community that runs its own preparation", () => {
  // The monetised partner's member: she completes none of EmpowerFI's modules
  // and all of her community's reviewed ones. core_modules_total is global, so
  // under v1 this is NEEDS_PREPARATION for good and she can never borrow.
  const member = raw({
    core_modules_completed: 0,
    equivalent_modules_total: 8,
    equivalent_modules_completed: 8,
    checkins: months({ recordsKeptFrom: 1 }),
  });

  it("v1 pins her at NEEDS_PREPARATION", () => {
    const v1 = assessReadiness(member as ReadinessRawInput);
    expect(v1.result.status).toBe("NEEDS_PREPARATION");
    expect(v1.result.missing_requirements.map((m) => m.code)).toContain("CORE_EDUCATION_INCOMPLETE");
  });

  it("v2 reaches her, and says which route did it", () => {
    const v2 = assessReadinessV2(member);
    expect(v2.result.status).toBe("CREDIT_READY");
    expect(v2.result.preparation_evidence).toBe("COMMUNITY_EQUIVALENT");
    expect(v2.result.reason_codes).toContain("EDUCATION_COMPLETE");
  });

  it("an unreviewed programme is no programme: zero modules declared, zero credit", () => {
    const unreviewed = { ...member, equivalent_modules_total: 0, equivalent_modules_completed: 0 };
    const v2 = assessReadinessV2(unreviewed);
    expect(v2.result.preparation_evidence).toBe("NONE");
    expect(v2.result.status).toBe("NEEDS_PREPARATION");
  });
});

describe("the demonstration route", () => {
  it("six unbroken months, every sale recorded, nothing contradictory", () => {
    const v2 = assessReadinessV2(raw({ core_modules_completed: 0 }));
    expect(v2.result.preparation_evidence).toBe("DEMONSTRATED");
    expect(v2.result.status).toBe("CREDIT_READY");
    // It stands in for a taught programme, so it is not a reason to say one
    // was completed.
    expect(v2.result.reason_codes).not.toContain("EDUCATION_COMPLETE");
  });

  it("scores the same as completing the core programme", () => {
    const taught = assessReadinessV2(raw());
    const shown = assessReadinessV2(raw({ core_modules_completed: 0 }));
    expect(shown.result.components).toEqual(taught.result.components);
    expect(shown.result.score).toBe(taught.result.score);
    expect(shown.result.components.preparation).toBe(25);
    expect(shown.result.score).toBe(97);
    expect(shown.result.band).toBe("HIGH");
  });

  it("five months is not six", () => {
    const v2 = assessReadinessV2(raw({ core_modules_completed: 0, checkins: months({ count: 5 }) }));
    expect(v2.result.preparation_evidence).toBe("NONE");
    expect(v2.result.status).toBe("NEEDS_PREPARATION");
  });

  it("one unrecorded month is not every sale", () => {
    const v2 = assessReadinessV2(raw({ core_modules_completed: 0, checkins: months({ recordsKeptFrom: 1 }) }));
    expect(v2.result.preparation_evidence).toBe("NONE");
  });

  it("does not bypass the other preparation requirements", () => {
    // Demonstrated, and the business loses money every month.
    const losing = months().map((c) => ({ ...c, cogs_cents: c.revenue_cents, opex_cents: 20_000 }));
    const v2 = assessReadinessV2(raw({ core_modules_completed: 0, checkins: losing }));
    expect(v2.result.preparation_evidence).toBe("DEMONSTRATED");
    expect(v2.result.status).toBe("NEEDS_PREPARATION");
    expect(v2.result.missing_requirements.map((m) => m.code)).toContain("CASH_FLOW_NOT_POSITIVE");
  });
});

describe("provenance", () => {
  it("names the strongest route she actually holds", () => {
    const both = raw({ equivalent_modules_total: 8, equivalent_modules_completed: 8 });
    expect(assessReadinessV2(both).result.preparation_evidence).toBe("CORE");
  });

  it("reports the gap in modules where a programme exists", () => {
    const m = assessReadinessV2(
      raw({ core_modules_completed: 5, checkins: months({ recordsKeptFrom: 1 }) }),
    ).result.missing_requirements.find((r) => r.code === "PREPARATION_NOT_EVIDENCED");
    expect(m).toEqual({ code: "PREPARATION_NOT_EVIDENCED", current: 5, required: 12 });
  });

  it("reports the gap in months where none does", () => {
    const m = assessReadinessV2(
      raw({ core_modules_total: 0, core_modules_completed: 0, checkins: months({ count: 4 }) }),
    ).result.missing_requirements.find((r) => r.code === "PREPARATION_NOT_EVIDENCED");
    expect(m).toEqual({ code: "PREPARATION_NOT_EVIDENCED", current: 4, required: 6 });
  });

  it("clamps a completion count that overshoots its total", () => {
    const f = computeFeaturesV2(raw({ equivalent_modules_total: 3, equivalent_modules_completed: 9 }));
    expect(f.equivalent_modules_completed).toBe(3);
  });
});
