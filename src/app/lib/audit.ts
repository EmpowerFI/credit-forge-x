import type { AnchorKind } from "./platform";

/** The audit console's five views, as paths under /app/audit. */
export const AUDIT_TABS = [
  { to: "", label: "Attestations", end: true },
  { to: "events", label: "Events" },
  { to: "models", label: "Models" },
  { to: "consents", label: "Consents" },
  { to: "system", label: "System" },
] as const;

export const PROOF_KIND_LABEL: Record<AnchorKind, string> = {
  community: "Community registration",
  community_verification: "Community verification",
  enrollment: "Borrower enrollment",
  consent: "Consent record",
  checkin: "Monthly check-in",
  readiness: "Readiness assessment",
  eligibility: "Eligibility assessment",
  opportunity: "Qualified opportunity",
  loan: "Loan terms",
  loan_transition: "Loan status change",
  payment: "Instalment paid",
  outcome: "Productive outcome",
  allocation: "Capital allocation",
};

export const EVENT_LABEL: Record<string, string> = {
  community_registered: "Community registered",
  community_verified: "Community verified",
  enrolled: "Participant enrolled",
  consent: "Consent recorded",
  checkin: "Check-in reported",
  readiness: "Readiness assessed",
  credit_intent: "Credit requested",
  eligibility: "Eligibility assessed",
  referred: "Referred to a partner",
  partner_decision: "Partner decided",
  loan: "Loan status changed",
  payment: "Instalment paid",
  outcome: "Outcome measured",
  investment: "Capital allocated",
  refund: "Refunded from the vault",
  outreach: "Community outreach",
};

export const ACTOR_LABEL: Record<string, string> = {
  entrepreneur: "Participant",
  community_leader: "Community leader",
  partner: "Credit partner",
  capital_provider: "Investor",
  auditor: "Auditor",
  admin: "EmpowerFI admin",
  system: "EmpowerFI engine",
};

/** The fields an assessment stores from the engine's result: what a re-run must reproduce. */
export const READINESS_RESULT_FIELDS = ["model_version", "status", "band", "score", "components", "missing_requirements", "reason_codes"] as const;
export const ELIGIBILITY_RESULT_FIELDS = [
  "model_version", "decision", "requested_amount_cents", "proposed_amount_cents", "term_months", "instalment_cents",
  "max_instalment_cents", "affordability_bps", "suggested_min_cents", "suggested_max_cents", "risk_band", "risk_points",
  "confidence", "reason_codes",
] as const;
