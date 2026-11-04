import { describe, expect, it, vi } from "vitest";

vi.mock("../diary/db", () => ({ diaryDb: {} }));

const { newMilestoneCode, rewardsProblem } = await import("./impacto");

const ok = { code: "m_1", threshold_days: 7, title: "Kit", how_to_redeem: "Cupom REDE10", redeem_url: "" };

describe("a sponsor's rewards, before they go", () => {
  it("accepts a gift with its code and an https link", () => {
    expect(rewardsProblem([ok, { ...ok, code: "m_2", threshold_days: 14, redeem_url: "https://rede.org/cupom" }])).toBeNull();
  });
  it("accepts no reward at all", () => {
    expect(rewardsProblem([])).toBeNull();
  });
  it("needs to say how to redeem it", () => {
    expect(rewardsProblem([{ ...ok, how_to_redeem: "  " }])).toMatch(/resgatar|redeem/);
  });
  it("refuses two rewards on the same day", () => {
    expect(rewardsProblem([ok, { ...ok, code: "m_2" }])).toMatch(/mesmo dia|same day/);
  });
  it("refuses a link that is not https", () => {
    expect(rewardsProblem([{ ...ok, redeem_url: "http://rede.org" }])).toMatch(/https/);
  });
  it("refuses days out of range", () => {
    expect(rewardsProblem([{ ...ok, threshold_days: 0 }])).not.toBeNull();
    expect(rewardsProblem([{ ...ok, threshold_days: 1.5 }])).not.toBeNull();
  });
  it("makes codes the database accepts", () => {
    expect(newMilestoneCode()).toMatch(/^[a-z0-9_]{2,40}$/);
  });
});

const { cohortSales } = await import("./impacto");
const month = (m: string, mean: number, median: number, suppressed = false) =>
  suppressed ? { month: m, suppressed: true, women: null } : { month: m, suppressed: false, women: 6, mean_sales_cents: mean, median_sales_cents: median };

describe("the cohort's sales", () => {
  it("compares the last two complete months, by the median", () => {
    const c = cohortSales([month("2026-09-01", 150000, 120000), month("2026-10-01", 180000, 132000), month("2026-11-01", 50000, 40000)], "2026-11-04");
    expect(c).toMatchObject({ month: "2026-10-01", mean_cents: 180000, median_cents: 132000, trend: "up", change_bps: 1000 });
  });
  it("says down, and steady within 1%", () => {
    expect(cohortSales([month("2026-09-01", 1, 100000), month("2026-10-01", 1, 90000)], "2026-11-04")?.trend).toBe("down");
    expect(cohortSales([month("2026-09-01", 1, 100000), month("2026-10-01", 1, 100500)], "2026-11-04")?.trend).toBe("steady");
  });
  it("counts the month in progress once it is over", () => {
    expect(cohortSales([month("2026-10-01", 1, 100000), month("2026-11-01", 1, 120000)], "2026-11-30")?.month).toBe("2026-11-01");
  });
  it("has no trend without the month just before, or with it hidden", () => {
    expect(cohortSales([month("2026-08-01", 1, 100000), month("2026-10-01", 1, 120000)], "2026-11-04")?.trend).toBeUndefined();
    expect(cohortSales([month("2026-09-01", 0, 0, true), month("2026-10-01", 1, 120000)], "2026-11-04")?.trend).toBeUndefined();
    expect(cohortSales([month("2026-11-01", 1, 1)], "2026-11-04")).toBeNull();
  });
});
