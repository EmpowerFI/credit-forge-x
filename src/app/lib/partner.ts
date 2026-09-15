import type { Tone } from "../components/product/StatusPill";
import type { CapitalUse, EligibilityDecision, LoanStatus, OpportunityStatus } from "./credit";
import type { FundingStatus, Grade } from "./investor";
import type { Database } from "./platform.types";
import type { CreditPurpose } from "./readiness";

type ReadinessBand = Database["public"]["Enums"]["readiness_band"];

// The partner's desk, as partner_desk() returns it: opportunities referred to
// the partner with their funding, the partner's decisions, and each loan with
// its schedule and settlement. Participants appear under a P- code.

export const PARTNER_TABS = [
  { to: "", label: "Pipeline", end: true },
  { to: "reviews", label: "Reviews" },
  { to: "decisions", label: "Decisions" },
  { to: "portfolio", label: "Portfolio" },
  { to: "servicing", label: "Servicing" },
] as const;

export interface DeskProof {
  kind: string;
  entity_id: string;
  status: string;
  signature: string | null;
  account: string | null;
  reconcile: string | null;
  confirmed_at: string | null;
}

export interface DeskFunding {
  status: FundingStatus | null;
  target_micro_usdc: number | null;
  funded_micro_usdc: number;
  fx_brl_per_usdc_milli: number | null;
  investors: number;
  real_micro_usdc: number;
  refund_due: number;
  refunded: number;
}

export interface DeskDecision {
  id: string;
  verdict: "approved" | "declined";
  approved_amount_cents: number | null;
  rate_bps: number | null;
  term_months: number | null;
  reason: string | null;
  decided_at: string;
  decided_by: string | null;
}

export interface DeskOpportunity {
  opportunity_id: string;
  participant: string;
  status: OpportunityStatus;
  amount_cents: number;
  requested_amount_cents: number;
  term_months: number;
  instalment_cents: number;
  purpose: CreditPurpose;
  risk_band: Grade;
  confidence: Grade;
  eligibility_decision: EligibilityDecision;
  eligibility_model: string;
  max_instalment_cents: number | null;
  affordability_bps: number | null;
  suggested_min_cents: number | null;
  suggested_max_cents: number | null;
  eligibility_reasons: string[];
  readiness_band: ReadinessBand;
  readiness_model: string;
  months_reported: number | null;
  avg_revenue_cents: number | null;
  avg_net_business_cents: number | null;
  revenue_cv_bps: number | null;
  business_sector: string | null;
  community_name: string | null;
  community_city: string | null;
  community_state: string | null;
  referred_at: string;
  is_simulated: boolean;
  funding: DeskFunding;
  decision: DeskDecision | null;
  loan: { id: string; status: LoanStatus } | null;
  proof: DeskProof | null;
}

export interface ScheduleRow {
  instalment_no: number;
  due_at: string | null;
  amount_cents: number;
  payment_id: string | null;
  paid_at: string | null;
  late: boolean;
  pix_e2e: string | null;
  proof: DeskProof | null;
  to_investors: { amount_micro_usdc: number; done: number; pending: number; held: number; failed: number; signatures: string[] };
}

export interface DeskLoan {
  id: string;
  opportunity_id: string;
  participant: string;
  status: LoanStatus;
  principal_cents: number;
  rate_bps: number;
  term_months: number;
  instalment_cents: number;
  purpose: CreditPurpose;
  risk_band: Grade;
  business_sector: string | null;
  created_at: string;
  disbursed_at: string | null;
  active_since: string | null;
  paid: number;
  received_cents: number;
  due_now: number;
  overdue: number;
  next_due_at: string | null;
  funding: DeskFunding;
  proof: DeskProof | null;
  release: { status: string; amount_micro_usdc: number; signature: string | null; at: string | null } | null;
  pix_payout: { e2e: string; amount_cents: number; at: string | null } | null;
  schedule: ScheduleRow[];
  events: { id: string; from_status: LoanStatus | null; to_status: LoanStatus; note: string | null; at: string; proof: DeskProof | null }[];
  outcome: {
    id: string; avg_revenue_before_cents: number; avg_revenue_after_cents: number; evc_cents: number;
    capital_use: CapitalUse; confidence: Grade; measured_at: string; proof: DeskProof | null;
  } | null;
}

export interface PartnerDesk {
  partner: { name: string; kind: string; min_ticket_cents: number; max_ticket_cents: number } | null;
  fx_brl_per_usdc_milli: number;
  ramp_bps: number;
  opportunities: DeskOpportunity[];
  loans: DeskLoan[];
}

/** Where a request stands on the partner's desk, from its first look to its last instalment. */
export type DeskStage =
  | "deciding" | "raising" | "to_formalise" | "disbursed" | "repaying" | "overdue"
  | "paid" | "defaulted" | "cancelled" | "declined" | "withdrawn";

export const STAGE: Record<DeskStage, { label: string; tone: Tone; next: string }> = {
  deciding: { label: "Awaiting your decision", tone: "info", next: "Review and decide" },
  raising: { label: "Approved · investors funding", tone: "caution", next: "Wait for funding, or decline" },
  to_formalise: { label: "Ready to formalise", tone: "positive", next: "Sign and disburse" },
  disbursed: { label: "Disbursed", tone: "info", next: "Start the repayment schedule" },
  repaying: { label: "Repaying", tone: "positive", next: "Record instalments" },
  overdue: { label: "Overdue", tone: "alert", next: "Follow up" },
  paid: { label: "Paid off", tone: "positive", next: "—" },
  defaulted: { label: "Defaulted", tone: "alert", next: "—" },
  cancelled: { label: "Declined at formalisation", tone: "neutral", next: "—" },
  declined: { label: "Declined", tone: "neutral", next: "—" },
  withdrawn: { label: "Withdrawn", tone: "neutral", next: "—" },
};

/** Funding still under way: the partner waits before it can disburse. */
export const isRaising = (f: DeskFunding) => f.status === "open" || f.status === "partially_funded";

export function stageOf(o: DeskOpportunity, loan?: DeskLoan): DeskStage {
  if (o.status === "referred") return "deciding";
  if (o.status === "withdrawn") return "withdrawn";
  const status = loan?.status ?? o.loan?.status;
  if (status === "CANCELLED") return "cancelled";
  if (o.status === "partner_declined") return "declined";
  if (status === "PARTNER_APPROVED" || status === "DRAFT") return isRaising(o.funding) ? "raising" : "to_formalise";
  if (status === "DISBURSED") return "disbursed";
  if (status === "ACTIVE") return (loan?.overdue ?? 0) > 0 ? "overdue" : "repaying";
  if (status === "PAID") return "paid";
  if (status === "DEFAULTED") return "defaulted";
  return "deciding";
}

/** Where the capital comes from, in one line. */
export function fundingLine(f: DeskFunding): { label: string; tone: Tone } {
  switch (f.status) {
    case null: return { label: "Your own capital · not shown to investors", tone: "neutral" };
    case "open": return { label: "Open to investors · nothing raised yet", tone: "info" };
    case "partially_funded": return { label: `Investors funding · ${pct(f)}% raised`, tone: "caution" };
    case "funded": return { label: `Funded by ${f.investors} investor${f.investors === 1 ? "" : "s"}`, tone: "positive" };
    case "refunded": return { label: f.refund_due ? "Investors being refunded" : "Investors refunded", tone: "neutral" };
    case "closed": return { label: "Closed · nothing was raised", tone: "neutral" };
  }
}

export const pct = (f: DeskFunding) =>
  f.target_micro_usdc ? Math.min(100, Math.round((f.funded_micro_usdc / f.target_micro_usdc) * 100)) : 0;

/** Principal still owed: what was lent, less the principal part of what came back (flat schedule). */
export const outstandingCents = (l: DeskLoan) =>
  ["ACTIVE", "DISBURSED"].includes(l.status) ? Math.max(0, l.principal_cents - Math.round((l.principal_cents * l.paid) / l.term_months)) : 0;

export const rate = (bps: number | null | undefined) => (bps === null || bps === undefined ? "—" : `${(bps / 100).toFixed(1)}% a month`);

export const LIVE_LOAN: LoanStatus[] = ["DISBURSED", "ACTIVE", "PAID", "DEFAULTED"];
