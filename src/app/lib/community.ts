import type { Tone } from "../components/product/StatusPill";
import type { Database } from "./platform.types";
import type { CreditPurpose, ReadinessStatus } from "./readiness";
import type { EligibilityDecision, LoanStatus, OpportunityStatus } from "./credit";
import type { ConsentRecord } from "./consent";

// Community Intelligence, as the database computes it (community_overview,
// community_participants, community_cohorts, community_participant). No
// reported sales or costs come back from any of them: regularity and data
// quality are scores, not accounts.

export type OutreachAction = Database["public"]["Enums"]["outreach_action"];

/** The six views of a community, as paths under /app/community/:id. */
export const COMMUNITY_TABS = [
  { to: "", label: "Overview", end: true },
  { to: "cohorts", label: "Cohorts" },
  { to: "participants", label: "Participants" },
  { to: "readiness", label: "Readiness" },
  { to: "pipeline", label: "Credit pipeline" },
  { to: "impact", label: "Impact" },
] as const;

export const STAGES = [
  "joined", "education", "data_sufficient", "credit_ready", "credit_intent", "eligible", "referred", "financed",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  joined: "Joined",
  education: "Education",
  data_sufficient: "Data sufficient",
  credit_ready: "Credit ready",
  credit_intent: "Credit intent",
  eligible: "Eligible",
  referred: "Referred",
  financed: "Financed",
};

/** What each stage means, for tooltips and legends. */
export const STAGE_HINT: Record<Stage, string> = {
  joined: "Active members of the community.",
  education: "Finished EmpowerFI's core readiness programme.",
  data_sufficient: "Educated, and reporting enough for the rules to judge.",
  credit_ready: "The readiness engine says CREDIT_READY.",
  credit_intent: "Ready, and asking for capital. Ready without asking is a complete outcome.",
  eligible: "The eligibility engine found an amount the business can carry.",
  referred: "The opportunity went to a credit partner.",
  financed: "The partner disbursed the loan.",
};

export const ACTION: Record<OutreachAction, { label: string; queue: string; button: string; minutes: number; tone: Tone }> = {
  checkin_reminder: { label: "Check-in reminder", queue: "Missing the latest check-in", button: "Log reminder", minutes: 5, tone: "info" },
  education_followup: { label: "Education follow-up", queue: "Core education unfinished", button: "Log follow-up", minutes: 15, tone: "info" },
  human_followup: { label: "Human follow-up", queue: "Manual review: needs a conversation", button: "Log conversation", minutes: 30, tone: "caution" },
  capital_need_check: { label: "Capital need check", queue: "Ready and asking: confirm the need", button: "Log check", minutes: 15, tone: "positive" },
  servicing_followup: { label: "Servicing follow-up", queue: "A loan instalment is late", button: "Log follow-up", minutes: 20, tone: "alert" },
};

export const READINESS_TONE: Record<ReadinessStatus, Tone> = {
  CREDIT_READY: "positive",
  NEEDS_MORE_DATA: "info",
  NEEDS_PREPARATION: "caution",
  MANUAL_REVIEW: "neutral",
};

/** A readiness requirement in the leader's words: what is missing, how far along. */
export function requirementForLeader(r: { code: string; current: number | null; required: number }): string {
  switch (r.code) {
    case "COMMUNITY_NOT_VERIFIED": return "Community not verified yet";
    case "CORE_EDUCATION_INCOMPLETE": return `Core education: ${r.current ?? 0} of ${r.required} modules`;
    case "RECORD_KEEPING": return `Records kept in ${Math.round((r.current ?? 0) / 100)}% of months (needs ${Math.round(r.required / 100)}%)`;
    case "CASH_FLOW_NOT_POSITIVE": return `${r.current ?? 0} of the last 3 months positive (needs ${r.required})`;
    case "INSUFFICIENT_HISTORY": return `${r.current ?? 0} months reported (needs ${r.required})`;
    case "IRREGULAR_REPORTING": return `Reporting run of ${r.current ?? 0} months (needs ${r.required})`;
    case "STALE_REPORTING": return r.current === null ? "No check-in yet" : `Last check-in ${r.current} months ago`;
    default: return r.code;
  }
}

export const REQUIREMENT_SHORT: Record<string, string> = {
  COMMUNITY_NOT_VERIFIED: "Community not verified",
  CORE_EDUCATION_INCOMPLETE: "Core education unfinished",
  RECORD_KEEPING: "Records not kept",
  CASH_FLOW_NOT_POSITIVE: "Cash flow not positive",
  INSUFFICIENT_HISTORY: "Too few months reported",
  IRREGULAR_REPORTING: "Irregular reporting",
  STALE_REPORTING: "Reporting stopped",
};

export interface Requirement { code: string; current: number | null; required: number }

export interface CommunityOverview {
  community: { id: string; name: string; kind: string; city: string; state: string; status: string; verified_at: string | null; is_simulated: boolean };
  as_of_period: string | null;
  hero: { participants: number; joined_this_month: number; education_complete: number; credit_ready: number; credit_intent: number; eligible: number; financed: number };
  funnel: { stage: Stage; n: number }[];
  health: {
    checkin_completion_bps: number | null;
    data_quality_bps: number | null;
    regularity_bps: number | null;
    needs_human_followup: number;
    avg_days_to_ready: number | null;
    credit_alerts: number;
  };
  queue: { action: OutreachAction; pending: number; contacted: number; participants: { entrepreneur_id: string; display_name: string }[] }[];
  recent_outreach: { action: OutreachAction; n: number; at: string }[];
}

export interface ParticipantRow {
  entrepreneur_id: string;
  display_name: string;
  business_name: string | null;
  business_sector: string | null;
  is_simulated: boolean;
  joined_at: string;
  intake: string;
  core_total: number;
  core_done: number;
  checkins: number;
  last_period: string | null;
  reported_latest: boolean;
  readiness_status: ReadinessStatus | null;
  readiness_band: string | null;
  readiness_score: number | null;
  regularity: number | null;
  data_quality: number | null;
  months_reported: number | null;
  missing_requirements: Requirement[];
  readiness_reasons: string[];
  intent_purpose: CreditPurpose | null;
  intent_cents: number | null;
  eligibility_decision: EligibilityDecision | null;
  eligibility_reasons: string[];
  opportunity_status: OpportunityStatus | null;
  referred_at: string | null;
  loan_status: LoanStatus | null;
  instalments_paid: number;
  loan_term: number | null;
  late: boolean;
  stage: Stage;
  stage_no: number;
  next_action: OutreachAction | null;
  contacted_at: string | null;
  /** Her latest consent record, with its proof. */
  consent: ConsentRecord | null;
}

export interface Cohort {
  intake: string;
  participants: number;
  funnel: Record<Stage, number>;
  days_to_ready: { le_30: number; d31_60: number; d61_90: number; gt_90: number; not_yet: number; median: number | null };
  not_ready_reasons: Record<string, number>;
  manual_review: number;
  need_by_purpose: Partial<Record<CreditPurpose, { n: number; cents: number }>>;
  operations: { referred: number; approved: number; disbursed: number };
  /** Counted only with her consent to impact figures; `withheld` says how many were left out, never who. */
  outcomes: { measured: number; revenue_up: number; as_declared: number; evc_cents: number; evc_positive: number; withheld: number };
}

export interface Proof { kind: string; entity_id: string; status: string; signature: string | null; reconcile: string | null }

export interface JourneyEvent {
  at: string;
  kind: "joined" | "consent" | "education" | "checkin" | "readiness" | "intent" | "intent_withdrawn" | "eligibility" | "referred"
    | "partner_decision" | "loan" | "payment" | "outcome" | "outreach";
  label: string;
  detail?: Record<string, unknown>;
  proof?: Proof | null;
}

export interface Journey {
  state: ParticipantRow & { assessed_at: string | null; model_version: string | null; first_ready_at: string | null; records_kept_bps: number | null; education_complete: boolean };
  consent: ConsentRecord | null;
  education: { module_id: string; title: string; position: number; program: string; core: boolean; status: string | null; completed_at: string | null }[];
  timeline: JourneyEvent[];
}

/** 0–25 component score as a percentage. */
export const scorePct = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round((v / 25) * 100));
export const bpsPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v / 100)}%`);
export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
