import { localized } from "../i18n";
import type { CreditPurpose } from "./readiness";
import type { AnchorKind } from "./platform";
import { platform } from "./platform";
import type { CapitalTotals } from "./community";
import type { PoolId } from "./capital";

// Impact Intelligence, as the database computes it (impact_intelligence): one
// sponsor's program over the communities that run it. Aggregates only, groups
// under five hidden, outcomes counted only with the impact consent.

export const FUNNEL = ["sponsored", "engaged", "reporting", "prepared", "credit_ready", "requested_capital", "funded", "performing"] as const;
export type FunnelStage = (typeof FUNNEL)[number];

export interface SegmentGroup { key: string; n: number | null; share_bps: number | null; cents?: number | null; suppressed: boolean }
export type SegmentId = "readiness" | "data_quality" | "sector" | "geography" | "credit_intent" | "purpose";

export interface ImpactProof {
  kind: AnchorKind;
  entity_id: string;
  status: string;
  signature: string | null;
  account: string | null;
  commitment: string | null;
  confirmed_at: string | null;
}

export interface ImpactOpportunity {
  opportunity_id: string;
  code: string;
  community: string | null;
  purpose: CreditPurpose;
  amount_cents: number;
  term_months: number;
  risk_band: "LOW" | "MEDIUM" | "HIGH";
  funding_pool: PoolId | null;
  funding_status: "waiting" | "open" | "partially_funded" | "funded" | "closed" | "refunded" | null;
  loan_status: string | null;
  late: boolean | null;
  in_engine: boolean;
}

export interface ImpactIntelligence {
  program: {
    id: string; name: string; description: string | null; period_start: string; period_end: string;
    funding_committed_cents: number; funding_deployed_cents: number; is_simulated: boolean;
  };
  sponsor: { id: string; name: string; kind: "company" | "foundation" | "impact_fund"; is_simulated: boolean };
  as_of_period: string | null;
  communities: { id: string; name: string; kind: string; city: string | null; state: string | null; status: string; participants: number; credit_ready: number; funded_cents: number }[];
  hero: {
    reached: number; reporting: number; credit_ready: number; requested: number;
    capital_requested_cents: number; capital_mobilized_cents: number;
    loans_disbursed: number; outcomes_measured: number; outcomes_withheld: number;
  };
  funnel: { stage: FunnelStage; n: number }[];
  segments: Record<SegmentId, SegmentGroup[]>;
  capital: Pick<CapitalTotals, "eligible_cents" | "funded_cents" | "gap_cents" | "domestic_cents" | "global_cents" | "domestic_coverage_bps" | "global_coverage_bps"> & { waiting_for_capital: number };
  portfolio: {
    financed_cents: number; repaid_cents: number; instalments_paid: number; instalments_due: number;
    loans_repaying: number; loans_late: number; loans_paid: number; loans_defaulted: number;
  };
  outcomes: {
    measured: number; withheld: number; revenue_up: number; revenue_change_bps: number | null;
    as_declared: number; partly_as_declared: number; other_use: number; not_reported: number;
    evc_cents: number; evc_positive: number;
  };
  evidence: {
    total: number; confirmed: number; pending: number; failed: number; mismatches: number; last_confirmed_at: string | null;
    by_kind: { kind: AnchorKind; total: number; confirmed: number }[];
    latest: ImpactProof[];
  };
  opportunities: ImpactOpportunity[];
}

export interface ProgramRow { id: string; name: string; period_start: string; period_end: string }

export async function fetchPrograms(): Promise<ProgramRow[]> {
  const { data, error } = await platform.from("programs").select("id, name, period_start, period_end").order("period_start", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchImpactIntelligence(programId: string): Promise<ImpactIntelligence> {
  const { data, error } = await platform.rpc("impact_intelligence", { p_program_id: programId });
  if (error) throw error;
  return data as unknown as ImpactIntelligence;
}

export const FUNNEL_LABEL: Record<FunnelStage, { label: string; hint: string }> = localized({
  sponsored: {
    label: { en: "Sponsored", pt: "Patrocinadas" },
    hint: { en: "Enrolled in a community that runs the program.", pt: "Inscritas numa comunidade que conduz o programa." },
  },
  engaged: {
    label: { en: "Engaged", pt: "Engajadas" },
    hint: { en: "Started the education or reported a month.", pt: "Começaram a formação ou informaram um mês." },
  },
  reporting: {
    label: { en: "Reporting", pt: "Reportando" },
    hint: { en: "Reported their business in a monthly check-in.", pt: "Informaram o negócio num check-in mensal." },
  },
  prepared: {
    label: { en: "Prepared", pt: "Preparadas" },
    hint: { en: "Education complete, with enough data to be assessed.", pt: "Formação concluída, com dados suficientes para avaliação." },
  },
  credit_ready: {
    label: { en: "Credit ready", pt: "Prontas para crédito" },
    hint: { en: "The readiness engine found the business ready. Ready and not asking is a complete outcome.", pt: "O motor de prontidão considerou o negócio pronto. Estar pronta e não pedir é um resultado completo." },
  },
  requested_capital: {
    label: { en: "Requested capital", pt: "Pediram capital" },
    hint: { en: "Asked for productive credit.", pt: "Pediram crédito produtivo." },
  },
  funded: {
    label: { en: "Funded", pt: "Captadas" },
    hint: { en: "Fully funded by investors, or lent.", pt: "100% captadas por investidores, ou emprestadas." },
  },
  performing: {
    label: { en: "Performing", pt: "Em dia" },
    hint: { en: "Lent and repaying on schedule, or paid off.", pt: "Emprestadas e pagando em dia, ou quitadas." },
  },
});

export const SEGMENT_TITLE: Record<SegmentId, string> = localized({
  readiness: { en: "Readiness", pt: "Prontidão" },
  data_quality: { en: "Data quality", pt: "Qualidade dos dados" },
  sector: { en: "Sector", pt: "Setor" },
  geography: { en: "Geography", pt: "Território" },
  credit_intent: { en: "Credit intent", pt: "Intenção de crédito" },
  purpose: { en: "Capital purpose", pt: "Finalidade do capital" },
});

export const SEGMENT_KEY: Record<string, string> = localized({
  not_assessed: { en: "Not assessed yet", pt: "Ainda sem avaliação" },
  high: { en: "High", pt: "Alta" },
  medium: { en: "Medium", pt: "Média" },
  low: { en: "Low", pt: "Baixa" },
  requested: { en: "Requested capital", pt: "Pediram capital" },
  ready_not_asking: { en: "Ready, not asking", pt: "Prontas, sem pedir" },
  not_ready: { en: "Not ready yet", pt: "Ainda não prontas" },
});

/** The proof kinds, grouped as a sponsor reads the lifecycle. */
export const EVIDENCE_GROUPS: { id: string; label: string; kinds: AnchorKind[] }[] = localized([
  { id: "community", label: { en: "Communities verified", pt: "Comunidades verificadas" }, kinds: ["community", "community_verification"] },
  { id: "participation", label: { en: "Participation and reporting", pt: "Participação e reporte" }, kinds: ["enrollment", "checkin"] },
  { id: "consent", label: { en: "Consent", pt: "Consentimento" }, kinds: ["consent"] },
  { id: "readiness", label: { en: "Readiness and eligibility attestations", pt: "Atestados de prontidão e elegibilidade" }, kinds: ["readiness", "eligibility"] },
  { id: "funding", label: { en: "Funding events", pt: "Eventos de captação" }, kinds: ["opportunity", "allocation", "loan", "loan_transition"] },
  { id: "repayment", label: { en: "Repayments", pt: "Pagamentos" }, kinds: ["payment"] },
  { id: "outcome", label: { en: "Outcome proofs", pt: "Provas de resultado" }, kinds: ["outcome"] },
]);
