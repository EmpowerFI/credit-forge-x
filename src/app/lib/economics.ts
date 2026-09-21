import { formatNumber, localized, tr } from "../i18n";
import { platform } from "./platform";

// Operating economics, as the database measures it (operating_economics): can
// productive credit become cheaper to operate without becoming weaker credit?
// The prototype measures; it does not claim the answer (refactor spec §2A).

export type CostPhase = "preparation" | "origination" | "servicing";
export type TimingStep = "intent_to_eligibility" | "eligibility_to_opportunity" | "opportunity_to_decision" | "decision_to_disbursement" | "intent_to_disbursement";

/** Which card priced a cost: a version, and whether its numbers are assumed or measured. */
export interface RateCard {
  version: string;
  source: "simulated" | "observed";
  effective_from: string;
  note: string;
}

export interface OperatingEconomics {
  scope: { program_id: string | null; communities: number; participants: number };
  cost: {
    total_cents: number; staff_minutes: number; events: number; automated_events_share_bps: number | null;
    by_phase: Record<CostPhase, number>;
    minutes_by_phase: { preparation: number; credit: number };
    per_participant_cents: number | null; per_opportunity_cents: number | null; per_loan_cents: number | null;
    credit_minutes_per_loan: number | null;
    per_100_disbursed_cents: number | null; credit_per_100_disbursed_cents: number | null;
    opportunities: number; loans: number; disbursed_cents: number;
    rate_card: RateCard; rate_card_is_assumption: boolean; rate_cards_used: string[];
    by_stage: { stage: string; phase: CostPhase; borne_by: "empowerfi" | "community" | "partner"; events: number; staff_minutes: number; cents: number }[];
  };
  timing: { step: TimingStep; n: number; median_seconds: number | null; p90_seconds: number | null }[];
  discipline: {
    runs: number;
    decisions: Partial<Record<"ELIGIBLE" | "ELIGIBLE_REDUCED" | "MANUAL_REVIEW" | "NOT_ELIGIBLE", number>>;
    reasons: { code: string; n: number }[];
    affordability_checked: number;
    model_versions: string[];
  };
  capital: { opportunities: number; allocated: number; domestic: number; global: number; waiting: number; funded: number; reasons: { code: string; n: number }[] };
  follow_up: { checkins: number; self_reported: number; reporting: number; open_follow_ups: number; contacts: number; instalments_recorded: number; outcomes_measured: number };
  quality: { loans: number; repaying: number; late: number; paid: number; defaulted: number; instalments_due: number; instalments_paid: number };
}

/**
 * What a larger ticket would do to cost per R$ 100 lent. A model over the rate
 * card, never over the recorded events: those are facts about work that
 * happened, and moving the ticket does not change them.
 */
export interface CostSensitivity {
  card: RateCard;
  basis: {
    program_id: string | null;
    participants: number; loans: number; disbursed_cents: number;
    current_ticket_cents: number | null;
    participants_per_loan: number | null;
    participants_per_loan_source: "observed" | "given" | null;
    occurrences: "observed" | "assumed";
  };
  per_loan: {
    credit_cents: number; pipeline_cents: number | null;
    by_stage: { stage: string; phase: CostPhase; borne_by: "empowerfi" | "community" | "partner"; cents: number; per_unit_milli: number; cents_per_loan: number }[];
  };
  tickets: { ticket_cents: number; is_current: boolean; credit_per_100_cents: number; per_100_disbursed_cents: number | null }[];
}

export async function fetchCostSensitivity(programId: string | null): Promise<CostSensitivity> {
  const { data, error } = await platform.rpc("cost_sensitivity", programId ? { p_program_id: programId } : {});
  if (error) throw error;
  return data as unknown as CostSensitivity;
}

export async function fetchOperatingEconomics(programId: string | null): Promise<OperatingEconomics> {
  const { data, error } = await platform.rpc("operating_economics", programId ? { p_program_id: programId } : {});
  if (error) throw error;
  return data as unknown as OperatingEconomics;
}

/** A duration, read at the scale it happened: seconds, minutes, hours or days. */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const n = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
  if (seconds < 60) return seconds === 0 ? tr({ en: "instant", pt: "imediato" }) : `${n(seconds)} s`;
  if (seconds < 3600) return `${n(Math.round(seconds / 60))} min`;
  if (seconds < 48 * 3600) return `${n(Math.round(seconds / 360) / 10)} h`;
  return tr({ en: `${n(Math.round(seconds / 8640) / 10)} days`, pt: `${n(Math.round(seconds / 8640) / 10)} dias` });
}

/** Staff time, always in hours: days of staff time read like calendar days. */
export const staffHours = (minutes: number | null | undefined) =>
  minutes == null ? "—" : minutes === 0 ? tr({ en: "none", pt: "nenhum" }) : `${formatNumber(minutes / 60, { maximumFractionDigits: minutes < 600 ? 1 : 0 })} h`;

export const bps = (value: number | null | undefined) => (value == null ? "—" : `${formatNumber(value / 100, { maximumFractionDigits: 1 })}%`);
export const share = (part: number, whole: number) => (whole > 0 ? `${formatNumber((part / whole) * 100, { maximumFractionDigits: 0 })}%` : "—");

export const STEP_LABEL: Record<TimingStep, { label: string; who: string }> = localized({
  intent_to_eligibility: {
    label: { en: "Request → eligibility", pt: "Pedido → elegibilidade" },
    who: { en: "Credit engine, automated", pt: "Motor de crédito, automático" },
  },
  eligibility_to_opportunity: {
    label: { en: "Eligibility → qualified opportunity", pt: "Elegibilidade → oportunidade qualificada" },
    who: { en: "Automated, unless held for review", pt: "Automático, salvo se retida para revisão" },
  },
  opportunity_to_decision: {
    label: { en: "Opportunity → desk decision", pt: "Oportunidade → decisão da mesa" },
    who: { en: "Funding, then the desk's analyst", pt: "Captação, depois a analista da mesa" },
  },
  decision_to_disbursement: {
    label: { en: "Decision → disbursement", pt: "Decisão → desembolso" },
    who: { en: "Contract and simulated Pix", pt: "Contrato e Pix simulado" },
  },
  intent_to_disbursement: {
    label: { en: "Request → money in her account", pt: "Pedido → dinheiro na conta dela" },
    who: { en: "End to end", pt: "Ponta a ponta" },
  },
});

export const PHASE_LABEL: Record<CostPhase, string> = localized({
  preparation: { en: "Preparation", pt: "Preparo" },
  origination: { en: "Origination", pt: "Originação" },
  servicing: { en: "Servicing", pt: "Acompanhamento" },
});

/** What the numbers on a rate card are. */
export const CARD_SOURCE: Record<"simulated" | "observed", string> = localized({
  simulated: { en: "assumptions", pt: "premissas" },
  observed: { en: "measured in the pilot", pt: "medido no piloto" },
});

export const BEARER_LABEL: Record<"empowerfi" | "community" | "partner", string> = localized({
  empowerfi: { en: "EmpowerFI", pt: "EmpowerFI" },
  community: { en: "Community", pt: "Comunidade" },
  partner: { en: "Desk", pt: "Mesa" },
});

export const STAGE_LABEL: Record<string, string> = localized({
  community_onboarding: { en: "Community onboarding", pt: "Entrada da comunidade" },
  community_verification: { en: "Community verification", pt: "Verificação da comunidade" },
  enrollment: { en: "Enrolment", pt: "Inscrição" },
  education: { en: "Education", pt: "Formação" },
  outreach: { en: "Community follow-up", pt: "Acompanhamento da comunidade" },
  checkin: { en: "Monthly check-ins", pt: "Check-ins mensais" },
  readiness_assessment: { en: "Readiness engine", pt: "Motor de prontidão" },
  credit_intent: { en: "Credit request", pt: "Pedido de crédito" },
  eligibility_assessment: { en: "Eligibility engine", pt: "Motor de elegibilidade" },
  opportunity_preparation: { en: "Opportunity preparation", pt: "Preparo da oportunidade" },
  partner_referral: { en: "Referral to the desk", pt: "Encaminhamento à mesa" },
  partner_decision: { en: "Desk decision", pt: "Decisão da mesa" },
  disbursement: { en: "Disbursement", pt: "Desembolso" },
  servicing: { en: "Instalments recorded", pt: "Parcelas registradas" },
  outcome_measurement: { en: "Outcome measurement", pt: "Medição de resultado" },
  chain_anchoring: { en: "Proofs on Solana", pt: "Provas na Solana" },
});

export const DECISION_LABEL: Record<string, string> = localized({
  ELIGIBLE: { en: "Eligible", pt: "Elegível" },
  ELIGIBLE_REDUCED: { en: "Eligible for less", pt: "Elegível para menos" },
  MANUAL_REVIEW: { en: "Held for review", pt: "Retida para revisão" },
  NOT_ELIGIBLE: { en: "Not eligible", pt: "Não elegível" },
});
