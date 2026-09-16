import { describe, expect, it } from "vitest";
import { fundingLine, outstandingCents, stageOf, type DeskFunding, type DeskLoan, type DeskOpportunity } from "./partner";

const funding = (over: Partial<DeskFunding> = {}): DeskFunding => ({
  status: "funded", target_micro_usdc: 400_000_000, funded_micro_usdc: 400_000_000, fx_brl_per_usdc_milli: 5400,
  investors: 3, real_micro_usdc: 0, refund_due: 0, refunded: 0, pool: "global", reason_codes: ["GLOBAL_EXPANDS_CAPACITY"],
  rate_bps_month: 217, instalment_cents: 56_510, ...over,
});
const opp = (over: Partial<DeskOpportunity> = {}) => ({ status: "partner_approved", funding: funding(), loan: null, ...over }) as DeskOpportunity;
const loan = (over: Partial<DeskLoan> = {}) =>
  ({ status: "ACTIVE", overdue: 0, principal_cents: 120_000, term_months: 12, paid: 0, ...over }) as DeskLoan;

describe("where a request stands on the P2P desk", () => {
  it("before a loan: waiting for a pool, raising, or ready to formalise once funded", () => {
    expect(stageOf(opp({ status: "referred", funding: funding({ status: null, pool: null }) }))).toBe("waiting");
    expect(stageOf(opp({ status: "referred", funding: funding({ status: "partially_funded" }) }))).toBe("raising");
    expect(stageOf(opp({ status: "referred", funding: funding({ status: "open" }) }))).toBe("raising");
    expect(stageOf(opp({ status: "referred" }))).toBe("to_formalise");
  });

  it("formalised at the engine's rate, then disbursed", () => {
    expect(stageOf(opp(), loan({ status: "PARTNER_APPROVED" }))).toBe("formalised");
    expect(stageOf(opp(), loan({ status: "DISBURSED" }))).toBe("disbursed");
  });

  it("repaying, or overdue once an instalment is past due", () => {
    expect(stageOf(opp(), loan())).toBe("repaying");
    expect(stageOf(opp(), loan({ overdue: 2 }))).toBe("overdue");
  });

  it("a formalised loan cancelled is a decline at formalisation, not a plain decline", () => {
    expect(stageOf(opp({ status: "partner_declined" }), loan({ status: "CANCELLED" }))).toBe("cancelled");
    expect(stageOf(opp({ status: "partner_declined" }))).toBe("declined");
  });
});

describe("the capital behind a request", () => {
  it("says whose it is", () => {
    expect(fundingLine(funding({ status: null, pool: null })).label).toMatch(/no pool yet/);
    expect(fundingLine(funding({ status: "partially_funded", funded_micro_usdc: 180_000_000 })).label).toBe("Investors funding · 45% raised");
    expect(fundingLine(funding({ investors: 1 })).label).toBe("Funded by 1 investor");
    expect(fundingLine(funding({ status: "refunded", refund_due: 1 })).label).toBe("Investors being refunded");
  });
});

describe("principal outstanding", () => {
  it("falls by a twelfth with each of twelve instalments, and is nothing once the loan is closed", () => {
    expect(outstandingCents(loan())).toBe(120_000);
    expect(outstandingCents(loan({ paid: 3 }))).toBe(90_000);
    expect(outstandingCents(loan({ status: "PAID", paid: 12 }))).toBe(0);
    expect(outstandingCents(loan({ status: "PARTNER_APPROVED" }))).toBe(0);
  });
});
