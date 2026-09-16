import type { Tone } from "../components/product/StatusPill";
import type { Database } from "./platform.types";
import type { CreditPurpose, ReadinessStatus } from "./readiness";
import type { EligibilityDecision, LoanStatus, OpportunityStatus } from "./credit";
import type { ConsentRecord } from "./consent";
import { formatDate, localized, tr } from "../i18n";

// Community Intelligence, as the database computes it (community_overview,
// community_participants, community_cohorts, community_participant). No
// reported sales or costs come back from any of them: regularity and data
// quality are scores, not accounts.

export type OutreachAction = Database["public"]["Enums"]["outreach_action"];

/** The six views of a community, as paths under /app/community/:id. */
export const COMMUNITY_TABS = localized([
  { to: "", label: { en: "Overview", pt: "Visão geral" }, end: true },
  { to: "cohorts", label: { en: "Cohorts", pt: "Turmas" } },
  { to: "participants", label: { en: "Participants", pt: "Participantes" } },
  { to: "readiness", label: { en: "Readiness", pt: "Prontidão" } },
  { to: "pipeline", label: { en: "P2P pipeline", pt: "Pipeline P2P" } },
  { to: "impact", label: { en: "Impact", pt: "Impacto" } },
] as const);

export const STAGES = [
  "joined", "education", "data_sufficient", "credit_ready", "credit_intent", "eligible", "p2p_opportunity", "funded",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = localized({
  joined: { en: "Joined", pt: "Entrou" },
  education: { en: "Education", pt: "Formação" },
  data_sufficient: { en: "Data sufficient", pt: "Dados suficientes" },
  credit_ready: { en: "Credit ready", pt: "Pronta para crédito" },
  credit_intent: { en: "Credit intent", pt: "Pedido de crédito" },
  eligible: { en: "Eligible", pt: "Elegível" },
  p2p_opportunity: { en: "P2P opportunity", pt: "Oportunidade P2P" },
  funded: { en: "Funded", pt: "Captada" },
});

/** What each stage means, for tooltips and legends. */
export const STAGE_HINT: Record<Stage, string> = localized({
  joined: { en: "Active members of the community.", pt: "Integrantes ativas da comunidade." },
  education: {
    en: "Finished EmpowerFI's core readiness programme.",
    pt: "Concluíram a formação essencial de prontidão da EmpowerFI.",
  },
  data_sufficient: {
    en: "Educated, and reporting enough for the rules to judge.",
    pt: "Com a formação concluída e dados suficientes para as regras avaliarem.",
  },
  credit_ready: { en: "The readiness engine says CREDIT_READY.", pt: "O motor de prontidão indica CREDIT_READY." },
  credit_intent: {
    en: "Ready, and asking for capital. Ready without asking is a complete outcome.",
    pt: "Prontas e pedindo capital. Estar pronta sem pedir também é um resultado completo.",
  },
  eligible: {
    en: "The eligibility engine found an amount the business can carry.",
    pt: "O motor de elegibilidade encontrou um valor que o negócio consegue pagar.",
  },
  p2p_opportunity: {
    en: "A qualified P2P opportunity, given a pool of capital by the allocation engine.",
    pt: "Uma oportunidade P2P qualificada, com um pool de capital definido pelo Motor de Alocação de Capital.",
  },
  funded: {
    en: "Investors funded it, or the loan was disbursed.",
    pt: "Os investidores completaram a captação, ou o empréstimo foi desembolsado.",
  },
});

export const ACTION: Record<OutreachAction, { label: string; queue: string; button: string; minutes: number; tone: Tone }> = localized({
  checkin_reminder: {
    label: { en: "Check-in reminder", pt: "Lembrete de check-in" },
    queue: { en: "Missing the latest check-in", pt: "Falta o último check-in" },
    button: { en: "Log reminder", pt: "Registrar lembrete" },
    minutes: 5, tone: "info",
  },
  education_followup: {
    label: { en: "Education follow-up", pt: "Acompanhamento da formação" },
    queue: { en: "Core education unfinished", pt: "Formação essencial não concluída" },
    button: { en: "Log follow-up", pt: "Registrar acompanhamento" },
    minutes: 15, tone: "info",
  },
  human_followup: {
    label: { en: "Human follow-up", pt: "Acompanhamento pessoal" },
    queue: { en: "Manual review: needs a conversation", pt: "Revisão manual: precisa de uma conversa" },
    button: { en: "Log conversation", pt: "Registrar conversa" },
    minutes: 30, tone: "caution",
  },
  readiness_followup: {
    label: { en: "Readiness follow-up", pt: "Acompanhamento de prontidão" },
    queue: { en: "One requirement from credit ready", pt: "A um requisito de ficar pronta para crédito" },
    button: { en: "Log follow-up", pt: "Registrar acompanhamento" },
    minutes: 15, tone: "info",
  },
  credit_intent_check: {
    label: { en: "Credit intent check", pt: "Conversa sobre pedido de crédito" },
    queue: { en: "Credit ready, not asking: is there a need?", pt: "Pronta para crédito, sem pedido: existe uma necessidade?" },
    button: { en: "Log check", pt: "Registrar conversa" },
    minutes: 15, tone: "positive",
  },
  capital_need_check: {
    label: { en: "Eligibility check", pt: "Verificação de elegibilidade" },
    queue: { en: "Asking: eligibility not assessed yet", pt: "Pediu crédito: elegibilidade ainda não avaliada" },
    button: { en: "Log check", pt: "Registrar verificação" },
    minutes: 15, tone: "positive",
  },
  funding_followup: {
    label: { en: "Funding update", pt: "Atualização da captação" },
    queue: { en: "Her P2P opportunity is not funded yet", pt: "A oportunidade P2P dela ainda não foi captada" },
    button: { en: "Log update", pt: "Registrar atualização" },
    minutes: 10, tone: "info",
  },
  servicing_followup: {
    label: { en: "Servicing follow-up", pt: "Acompanhamento de pagamentos" },
    queue: { en: "A loan instalment is late", pt: "Uma parcela do empréstimo está em atraso" },
    button: { en: "Log follow-up", pt: "Registrar acompanhamento" },
    minutes: 20, tone: "alert",
  },
});

export const READINESS_TONE: Record<ReadinessStatus, Tone> = {
  CREDIT_READY: "positive",
  NEEDS_MORE_DATA: "info",
  NEEDS_PREPARATION: "caution",
  MANUAL_REVIEW: "neutral",
};

/** A readiness requirement in the leader's words: what is missing, how far along. */
export function requirementForLeader(r: { code: string; current: number | null; required: number }): string {
  const current = r.current ?? 0;
  switch (r.code) {
    case "COMMUNITY_NOT_VERIFIED": return tr({ en: "Community not verified yet", pt: "Comunidade ainda não verificada" });
    case "CORE_EDUCATION_INCOMPLETE": return tr({
      en: `Core education: ${current} of ${r.required} modules`,
      pt: `Formação essencial: ${current} de ${r.required} módulos`,
    });
    case "RECORD_KEEPING": return tr({
      en: `Records kept in ${Math.round(current / 100)}% of months (needs ${Math.round(r.required / 100)}%)`,
      pt: `Registros mantidos em ${Math.round(current / 100)}% dos meses (precisa de ${Math.round(r.required / 100)}%)`,
    });
    case "CASH_FLOW_NOT_POSITIVE": return tr({
      en: `${current} of the last 3 months positive (needs ${r.required})`,
      pt: `${current} dos últimos 3 meses no positivo (precisa de ${r.required})`,
    });
    case "INSUFFICIENT_HISTORY": return tr({
      en: `${current} months reported (needs ${r.required})`,
      pt: `${current} meses informados (precisa de ${r.required})`,
    });
    case "IRREGULAR_REPORTING": return tr({
      en: `Reporting run of ${current} months (needs ${r.required})`,
      pt: `${current} meses seguidos informados (precisa de ${r.required})`,
    });
    case "STALE_REPORTING": return r.current === null
      ? tr({ en: "No check-in yet", pt: "Nenhum check-in ainda" })
      : tr({ en: `Last check-in ${r.current} months ago`, pt: `Último check-in há ${r.current} meses` });
    default: return r.code;
  }
}

export const REQUIREMENT_SHORT: Record<string, string> = localized({
  COMMUNITY_NOT_VERIFIED: { en: "Community not verified", pt: "Comunidade não verificada" },
  CORE_EDUCATION_INCOMPLETE: { en: "Core education unfinished", pt: "Formação essencial não concluída" },
  RECORD_KEEPING: { en: "Records not kept", pt: "Sem registros do negócio" },
  CASH_FLOW_NOT_POSITIVE: { en: "Cash flow not positive", pt: "Fluxo de caixa não positivo" },
  INSUFFICIENT_HISTORY: { en: "Too few months reported", pt: "Poucos meses informados" },
  IRREGULAR_REPORTING: { en: "Irregular reporting", pt: "Dados informados sem regularidade" },
  STALE_REPORTING: { en: "Reporting stopped", pt: "Parou de informar os dados" },
});

export interface Requirement { code: string; current: number | null; required: number }

export interface CommunityOverview {
  community: { id: string; name: string; kind: string; city: string; state: string; status: string; verified_at: string | null; is_simulated: boolean };
  as_of_period: string | null;
  hero: {
    participants: number; joined_this_month: number; education_complete: number; credit_ready: number; credit_intent: number;
    eligible: number; p2p_opportunity: number; funded: number; qualified_demand_cents: number; funded_cents: number;
  };
  /** Totals only: never an investor, a wallet or a position. */
  capital: CapitalTotals & {
    financed_cents: number; repaid_cents: number; instalments_paid: number; instalments_due: number;
    loans_repaying: number; loans_late: number; loans_paid: number; loans_defaulted: number; waiting_for_capital: number;
  };
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

export interface CapitalTotals {
  eligible_cents: number;
  funded_cents: number;
  gap_cents: number;
  domestic_cents: number;
  global_cents: number;
  domestic_coverage_bps: number;
  global_coverage_bps: number;
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
  opportunity_cents: number | null;
  funding_pool: "domestic" | "global" | null;
  funding_status: string | null;
  funded_cents: number | null;
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
  capital: CapitalTotals;
  operations: { p2p_opportunities: number; funded: number; disbursed: number };
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
  iso ? formatDate(iso, { day: "2-digit", month: "short", year: "numeric" }) : "—";
