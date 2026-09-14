import type { Database } from "./platform.types";

type Enums = Database["public"]["Enums"];
export type EligibilityDecision = Enums["eligibility_decision"];
export type LoanStatus = Enums["loan_status"];
export type OpportunityStatus = Enums["opportunity_status"];
export type CapitalUse = Enums["capital_use"];

// The eligibility engine's codes, and the loan's life, in words.

export const DECISION_LABEL: Record<EligibilityDecision, { title: string; tone: string }> = {
  ELIGIBLE: { title: "Eligible", tone: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  ELIGIBLE_REDUCED: { title: "Eligible for a smaller amount", tone: "border-sky-300 bg-sky-50 text-sky-900" },
  MANUAL_REVIEW: { title: "Under review", tone: "border-slate-300 bg-slate-100 text-slate-900" },
  NOT_ELIGIBLE: { title: "Not eligible right now", tone: "border-amber-300 bg-amber-50 text-amber-900" },
};

export const ELIGIBILITY_REASON: Record<string, string> = {
  AFFORDABLE: "The instalment fits what the business makes",
  AMOUNT_ABOVE_CAPACITY: "The amount asked is more than the business can repay; a smaller one fits",
  NOT_CREDIT_READY: "Readiness comes first",
  AMOUNT_OUTSIDE_PRODUCT_RANGE: "The amount is outside the R$ 100–50,000 range",
  NO_REPAYMENT_CAPACITY: "After household expenses, nothing is left to repay from",
  HIGH_RISK: "Too many risk signals together",
  LOW_CONFIDENCE: "Too little history for the rules to decide alone",
  VOLATILE_INCOME: "Sales vary a lot month to month",
  DECLINING_REVENUE: "Sales are falling",
  HIGH_HOUSEHOLD_DRAW: "Most of the profit goes to the household",
  SHORT_HISTORY: "Less than six months of history",
  TIGHT_AFFORDABILITY: "The instalment takes over 20% of the monthly result",
  LOW_READINESS_BAND: "Readiness is on a low band",
};

export const OPPORTUNITY_LABEL: Record<OpportunityStatus, string> = {
  in_review: "Waiting for EmpowerFI's review",
  open: "Waiting for a partner",
  referred: "With the financial partner",
  partner_approved: "Approved by the partner",
  partner_declined: "Declined by the partner",
  withdrawn: "Withdrawn",
};

export const LOAN_LABEL: Record<LoanStatus, string> = {
  DRAFT: "Draft",
  PARTNER_APPROVED: "Approved",
  DISBURSED: "Disbursed",
  ACTIVE: "Repaying",
  PAID: "Paid off",
  DEFAULTED: "Defaulted",
  CANCELLED: "Cancelled",
};

export const CAPITAL_USE_LABEL: Record<CapitalUse, string> = {
  as_declared: "used as declared",
  partly_as_declared: "partly as declared",
  other_use: "used for something else",
  not_reported: "use not reported",
};

/** The next steps the partner may take — the same state machine as the program. */
export const NEXT_STATUSES: Record<LoanStatus, LoanStatus[]> = {
  DRAFT: ["CANCELLED"],
  PARTNER_APPROVED: ["DISBURSED", "CANCELLED"],
  DISBURSED: ["ACTIVE"],
  ACTIVE: ["PAID", "DEFAULTED"],
  PAID: [],
  DEFAULTED: [],
  CANCELLED: [],
};

/** How a partner sees a participant: a pseudonym, never a name. */
export const pseudonym = (entrepreneurId: string) => `P-${entrepreneurId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

export const percent = (bps: number | null | undefined) => (bps === null || bps === undefined ? "—" : `${(bps / 100).toFixed(1)}%`);
