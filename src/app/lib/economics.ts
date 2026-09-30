import { formatNumber, localized, tr } from "../i18n";
import { platform } from "./platform";

// Operating economics, as the database measures it (operating_economics): what
// it costs to operate productive credit, and what may not be sacrificed to make
// it cheaper (refactor spec §2A). Both halves of every pair are measured from
// recorded events; what is not yet field data is the rate card that prices them,
// and the screen says so there rather than doubting the model here.

export type CostPhase = "preparation" | "origination" | "servicing";
/** Who pays. Three businesses meet on this platform and only one of them is us. */
export type CostBearer = "empowerfi" | "community" | "partner";
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
    by_bearer: Partial<Record<CostBearer, { cents: number; staff_minutes: number; facts: number; preparation_cents: number; credit_cents: number }>>;
    minutes_by_phase: { preparation: number; credit: number };
    per_participant_cents: number | null; per_opportunity_cents: number | null; per_loan_cents: number | null;
    credit_minutes_per_loan: number | null;
    per_100_disbursed_cents: number | null; credit_per_100_disbursed_cents: number | null;
    opportunities: number; loans: number; disbursed_cents: number;
    rate_card: RateCard; rate_card_is_assumption: boolean; rate_cards_used: string[];
    by_stage: { stage: string; phase: CostPhase; borne_by: CostBearer; events: number; staff_minutes: number; cents: number }[];
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

/** What one entrepreneur's recorded journey cost, and the programme's number beside it. */
export interface JourneyCosts {
  total_cents: number; staff_minutes: number; events: number;
  first_at: string | null; last_at: string | null;
  by_phase: Record<CostPhase, number>;
  by_stage: { stage: string; phase: CostPhase; events: number; cents: number }[];
  rate_cards: string[];
}

export interface OpportunityEconomics {
  opportunity: { id: string; ticket_cents: number; allocated_at: string | null; allocation_model_version: string | null };
  /** Recorded for her, enrolment to now — a fact, not an estimate. */
  so_far: JourneyCosts & { per_100_of_ticket_cents: number | null };
  /** The same, frozen when the opportunity opened for funding. */
  at_allocation: {
    taken_at: string; ticket_cents: number; cost_total_cents: number; staff_minutes: number; events: number;
    by_phase: Record<CostPhase, number>; by_stage: JourneyCosts["by_stage"];
    per_100_of_ticket_cents: number | null; rate_card_version: string; allocation_model_version: string | null;
  } | null;
  /** Everyone counted, including everyone prepared who never borrowed. */
  programme: {
    program_id: string | null;
    per_100_disbursed_cents: number | null; credit_per_100_disbursed_cents: number | null;
    participants: number; loans: number; disbursed_cents: number; rate_card: RateCard;
  };
}

export async function fetchOpportunityEconomics(opportunityId: string): Promise<OpportunityEconomics> {
  const { data, error } = await platform.rpc("opportunity_economics", { p_opportunity_id: opportunityId });
  if (error) throw error;
  return data as unknown as OpportunityEconomics;
}

export async function fetchOperatingEconomics(programId: string | null): Promise<OperatingEconomics> {
  const { data, error } = await platform.rpc("operating_economics", programId ? { p_program_id: programId } : {});
  if (error) throw error;
  return data as unknown as OperatingEconomics;
}

/**
 * Cost to Mobilize Capital (addendum v2 §7, §8): what it costs to bring
 * international capital into reais, beside what it costs to serve the loan.
 *
 * Two rules the shape carries. The hedge is reported under cost_of_capital with
 * in_ctm false, because a required return on currency risk is not a fee paid to
 * a rail — summing the two would give a rate whose unit is half per-operation
 * and half per-year. And time to global funding is derived from the last
 * investment rather than from a column, so the screen says so.
 */
export interface CapitalMobilization {
  model_version: string;
  tickets: number;
  /** What actually crossed the border, in centavos. */
  mobilized_cents: number;
  /** Operating the mobilisation plus what the rails charged. Never the hedge. */
  cost_cents: number;
  /** cost over capital moved, in basis points — the same integer as centavos per R$ 100. */
  rate_bps: number | null;
  /** §10's Eligible External Capital Gap: gaps the global question allowed, still unfunded. */
  eligible_gap_cents: number;
  eligible_gap_decisions: number;
  disbursed_cents: number;
  /** What share of everything lent here was funded from outside Brazil. */
  global_funding_coverage_bps: number | null;
  time_to_global_funding: {
    n: number;
    median_seconds: number | null;
    p90_seconds: number | null;
    derived: boolean;
  };
  cost_of_capital: { fx_hedge_bps_year: number; in_ctm: boolean };
  rate_card: RateCard;
  provenance: Provenance;
}

export const capitalMobilizationKey = (programId: string | null) =>
  ["platform", "capital-mobilization", programId ?? "all"] as const;

export async function fetchCapitalMobilization(programId: string | null): Promise<CapitalMobilization> {
  const { data, error } = await platform.rpc("capital_mobilization_summary", programId ? { p_program_id: programId } : {});
  if (error) throw error;
  return data as unknown as CapitalMobilization;
}

/**
 * Was this measured, given to us, assumed, or quoted from a paper? A third
 * question beside REALITY ("is this rail real?") and the data legend ("who may
 * see this, and is it proven?"), and it replaces neither.
 */
export type Provenance = "observed" | "partner_provided" | "simulated" | "benchmark";

/**
 * What the platform is sold for, what it costs to run, and what is left
 * (business_model). EmpowerFI licenses a tool; the community does the
 * fieldwork on its own budget; the desk lends. A sponsor either pays the three
 * separately or buys one package, and which of the two it is comes from the
 * pricing card rather than from an assumption inside a query.
 */
export type BillingModel = "tool_licence" | "bundled";

export interface PricingCard {
  version: string;
  billing_model: BillingModel;
  source: "simulated" | "observed";
  seat_cents: number;
  floor_cents: number;
  community_share_cents: number;
  note: string;
  is_assumption: boolean;
  others: { version: string; billing_model: BillingModel; seat_cents: number; floor_cents: number }[];
}

export interface BusinessModel {
  pricing: PricingCard;
  scope: { program_id: string | null; participants: number; months_measured: number; first_at: string | null; last_at: string | null };
  monthly: {
    licence_cents: number; floor_applied: boolean;
    variable_cents: number; fixed_share_cents: number; passthrough_cents: number;
    cost_cents: number; margin_cents: number; margin_bps: number | null;
  };
  per_participant_month: {
    licence_cents: number | null; variable_cents: number | null;
    fixed_share_cents: number | null; community_cents: number | null;
  };
  /** A fixed block divided by seats shows no leverage; these two numbers do. */
  leverage: {
    capacity_participants: number | null;
    breakeven_participants: number | null;
    standalone_cost_cents: number;
    standalone_margin_bps: number | null;
  };
  evidence: { facts: number; proofs: number; proofs_per_participant: number | null; cost_per_proof_cents: number | null };
  borne_by: { empowerfi_cents: number; community_cents: number; partner_cents: number };
  rate_card: {
    version: string; source: "simulated" | "observed";
    fixed_monthly_cents: number | null;
    fixed_monthly_capacity_participants: number | null;
    fixed_monthly_note: string | null;
  };
}

export const businessModelKey = (programId: string | null, pricing: string | null) =>
  ["platform", "business-model", programId, pricing] as const;

export async function fetchBusinessModel(programId: string | null, pricingVersion?: string | null): Promise<BusinessModel> {
  const { data, error } = await platform.rpc("business_model", {
    ...(programId ? { p_program_id: programId } : {}),
    ...(pricingVersion ? { p_pricing_version: pricingVersion } : {}),
  });
  if (error) throw error;
  return data as unknown as BusinessModel;
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

export const PROVENANCE: Record<Provenance, { label: string; says: string; tone: "positive" | "info" | "caution" | "neutral" }> = localized({
  observed: {
    label: { en: "Observed", pt: "Observado" },
    says: { en: "Measured from what happened here.", pt: "Medido a partir do que aconteceu aqui." },
    tone: "positive",
  },
  partner_provided: {
    label: { en: "Partner-provided", pt: "Fornecido pelo parceiro" },
    says: { en: "A number a provider returned, not one this product assumed.", pt: "Um número que um provedor devolveu, não um que este produto supôs." },
    tone: "info",
  },
  simulated: {
    label: { en: "Simulated", pt: "Simulado" },
    says: { en: "An assumption of the prototype, stated on a versioned card.", pt: "Uma premissa do protótipo, declarada numa tabela versionada." },
    tone: "caution",
  },
  benchmark: {
    label: { en: "External benchmark", pt: "Referência externa" },
    says: { en: "Published elsewhere, about someone else, and never EmpowerFI's own measurement.", pt: "Publicado em outro lugar, sobre outra pessoa, e nunca a medição da própria EmpowerFI." },
    tone: "neutral",
  },
});

/** What the numbers on a rate card are. */
export const CARD_SOURCE: Record<"simulated" | "observed", string> = localized({
  simulated: { en: "assumptions", pt: "premissas" },
  observed: { en: "measured in the pilot", pt: "medido no piloto" },
});

export const BEARER_LABEL: Record<CostBearer, string> = localized({
  empowerfi: { en: "EmpowerFI", pt: "EmpowerFI" },
  community: { en: "Community", pt: "Comunidade" },
  partner: { en: "Desk", pt: "Mesa" },
});

/** What each of the three sells, said in one line, because "who pays" is not the same as "for what". */
export const BEARER_SELLS: Record<CostBearer, string> = localized({
  empowerfi: { en: "the tool, licensed", pt: "a ferramenta, licenciada" },
  community: { en: "the fieldwork, on its own budget", pt: "o trabalho de campo, com orçamento próprio" },
  partner: { en: "the credit, from its own book", pt: "o crédito, da carteira própria" },
});

export const BILLING_MODEL: Record<BillingModel, { label: string; says: string }> = localized({
  tool_licence: {
    label: { en: "Separate contracts", pt: "Contratos separados" },
    says: {
      en: "The sponsor licenses the tool from EmpowerFI and funds the community directly.",
      pt: "O patrocinador licencia a ferramenta da EmpowerFI e financia a comunidade diretamente.",
    },
  },
  bundled: {
    label: { en: "One package", pt: "Pacote único" },
    says: {
      en: "The sponsor buys one package and EmpowerFI passes the community's share through.",
      pt: "O patrocinador compra um pacote e a EmpowerFI repassa a parte da comunidade.",
    },
  },
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
