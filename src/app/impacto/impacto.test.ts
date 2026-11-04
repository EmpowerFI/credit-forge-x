import { describe, expect, it, vi } from "vitest";

vi.mock("../diary/db", () => ({ diaryDb: {} }));

const { newMilestoneCode, rewardsProblem } = await import("./impacto");

const ok = { code: "m_1", threshold_days: 7, title: "Kit", how_to_redeem: "Cupom REDE10", redeem_url: "" };

describe("a sponsor's rewards, before they go", () => {
  it("accepts a gift with its code and an https link", () => {
    expect(rewardsProblem([ok, { ...ok, code: "m_2", threshold_days: 14, redeem_url: "https://rede.org/cupom" }])).toBeNull();
  });
  it("needs at least one reward", () => {
    expect(rewardsProblem([])).not.toBeNull();
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
