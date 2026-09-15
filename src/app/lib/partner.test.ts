import { describe, expect, it } from "vitest";
import { fundingLine, outstandingCents, stageOf, type DeskFunding, type DeskLoan, type DeskOpportunity } from "./partner";

const funding = (over: Partial<DeskFunding> = {}): DeskFunding => ({
  status: "funded", target_micro_usdc: 400_000_000, funded_micro_usdc: 400_000_000, fx_brl_per_usdc_milli: 5400,
  investors: 3, real_micro_usdc: 0, refund_due: 0, refunded: 0, ...over,
});
const opp = (over: Partial<DeskOpportunity> = {}) => ({ status: "partner_approved", funding: funding(), loan: null, ...over }) as DeskOpportunity;
const loan = (over: Partial<DeskLoan> = {}) =>
  ({ status: "ACTIVE", overdue: 0, principal_cents: 120_000, term_months: 12, paid: 0, ...over }) as DeskLoan;

describe("where a request stands on the partner's desk", () => {
  it("waits on the partner while referred, whatever investors have done", () => {
    expect(stageOf(opp({ status: "referred", funding: funding({ status: "partially_funded" }) }))).toBe("deciding");
  });

  it("approved: raising while investors fund it, ready to formalise once funded or lent from the partner's own capital", () => {
    expect(stageOf(opp({ funding: funding({ status: "partially_funded" }) }), loan({ status: "PARTNER_APPROVED" }))).toBe("raising");
    expect(stageOf(opp({ funding: funding({ status: "open" }) }), loan({ status: "PARTNER_APPROVED" }))).toBe("raising");
    expect(stageOf(opp(), loan({ status: "PARTNER_APPROVED" }))).toBe("to_formalise");
    expect(stageOf(opp({ funding: funding({ status: null }) }), loan({ status: "PARTNER_APPROVED" }))).toBe("to_formalise");
  });

  it("repaying, or overdue once an instalment is past due", () => {
    expect(stageOf(opp(), loan())).toBe("repaying");
    expect(stageOf(opp(), loan({ overdue: 2 }))).toBe("overdue");
  });

  it("a loan cancelled after approval is a decline at formalisation, not a plain decline", () => {
    expect(stageOf(opp({ status: "partner_declined" }), loan({ status: "CANCELLED" }))).toBe("cancelled");
    expect(stageOf(opp({ status: "partner_declined" }))).toBe("declined");
  });
});

describe("the capital behind a request", () => {
  it("says whose it is", () => {
    expect(fundingLine(funding({ status: null })).label).toMatch(/own capital/);
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
