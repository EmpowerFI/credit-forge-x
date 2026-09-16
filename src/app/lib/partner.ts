import type { Tone } from "../components/product/StatusPill";
import { formatNumber, localized, tr } from "../i18n";
import type { CapitalUse, EligibilityDecision, LoanStatus, OpportunityStatus } from "./credit";
import type { FundingStatus, Grade } from "./investor";
import type { Database } from "./platform.types";
import type { CreditPurpose } from "./readiness";

type ReadinessBand = Database["public"]["Enums"]["readiness_band"];

// EmpowerFI's P2P desk, as partner_desk() returns it: qualified opportunities
// with their pool and funding, what the desk formalised or declined, and each
// loan with its schedule and settlement. Participants appear under a P- code.
// (The database still calls the desk a partner.)

export const PARTNER_TABS = localized([
  { to: "", label: { en: "Pipeline", pt: "Pipeline" }, end: true },
  { to: "reviews", label: { en: "Opportunities", pt: "Oportunidades" } },
  { to: "decisions", label: { en: "Decisions", pt: "Decisões" } },
  { to: "portfolio", label: { en: "Portfolio", pt: "Carteira" } },
  { to: "servicing", label: { en: "Servicing", pt: "Acompanhamento de pagamentos" } },
] as const);

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
  pool: "domestic" | "global" | null;
  reason_codes: string[] | null;
  /** What a formalised loan will carry: the allocation engine's rate and instalment. */
  rate_bps_month: number | null;
  instalment_cents: number | null;
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

/** Where a request stands on the desk, from listing to its last instalment. */
export type DeskStage =
  | "waiting" | "raising" | "to_formalise" | "formalised" | "disbursed" | "repaying" | "overdue"
  | "paid" | "defaulted" | "cancelled" | "declined" | "withdrawn";

export const STAGE: Record<DeskStage, { label: string; tone: Tone; next: string }> = localized({
  waiting: { label: { en: "Waiting for capital", pt: "Aguardando capital" }, tone: "neutral", next: { en: "No pool can take it yet", pt: "Nenhum pool pode assumir ainda" } },
  raising: { label: { en: "Investors funding", pt: "Em captação" }, tone: "caution", next: { en: "Wait for funding, or decline", pt: "Aguarde a captação ou recuse" } },
  to_formalise: { label: { en: "Ready to formalise", pt: "Pronta para formalizar" }, tone: "positive", next: { en: "Formalise and disburse", pt: "Formalizar e desembolsar" } },
  formalised: { label: { en: "Formalised", pt: "Formalizado" }, tone: "info", next: { en: "Disburse", pt: "Desembolsar" } },
  disbursed: { label: { en: "Disbursed", pt: "Desembolsado" }, tone: "info", next: { en: "Start the repayment schedule", pt: "Iniciar o cronograma de pagamentos" } },
  repaying: { label: { en: "Repaying", pt: "Em pagamento" }, tone: "positive", next: { en: "Record instalments", pt: "Registrar parcelas" } },
  overdue: { label: { en: "Overdue", pt: "Em atraso" }, tone: "alert", next: { en: "Follow up", pt: "Acompanhar" } },
  paid: { label: { en: "Paid off", pt: "Quitado" }, tone: "positive", next: "—" },
  defaulted: { label: { en: "Defaulted", pt: "Inadimplente" }, tone: "alert", next: "—" },
  cancelled: { label: { en: "Declined at formalisation", pt: "Recusado na formalização" }, tone: "neutral", next: "—" },
  declined: { label: { en: "Declined", pt: "Recusada" }, tone: "neutral", next: "—" },
  withdrawn: { label: { en: "Withdrawn", pt: "Retirada" }, tone: "neutral", next: "—" },
});

/** Funding still under way: the desk waits before it can formalise. */
export const isRaising = (f: DeskFunding) => f.status === "open" || f.status === "partially_funded";

export function stageOf(o: DeskOpportunity, loan?: DeskLoan): DeskStage {
  if (o.status === "withdrawn") return "withdrawn";
  const status = loan?.status ?? o.loan?.status;
  if (status === "CANCELLED") return "cancelled";
  if (o.status === "partner_declined") return "declined";
  if (!status) {
    if (o.funding.status === "funded") return "to_formalise";
    return isRaising(o.funding) ? "raising" : "waiting";
  }
  if (status === "PARTNER_APPROVED" || status === "DRAFT") return "formalised";
  if (status === "DISBURSED") return "disbursed";
  if (status === "ACTIVE") return (loan?.overdue ?? 0) > 0 ? "overdue" : "repaying";
  if (status === "PAID") return "paid";
  if (status === "DEFAULTED") return "defaulted";
  return "waiting";
}

/** Where the capital comes from, in one line. */
export function fundingLine(f: DeskFunding): { label: string; tone: Tone } {
  switch (f.status) {
    case null: return {
      label: f.pool
        ? tr({ en: "Not shown to investors", pt: "Não exibida a investidores" })
        : tr({ en: "Waiting for capital · no pool yet", pt: "Aguardando capital · ainda sem pool" }),
      tone: "neutral",
    };
    case "open": return { label: tr({ en: "Open to investors · nothing raised yet", pt: "Aberta a investidores · nada captado ainda" }), tone: "info" };
    case "partially_funded": return { label: tr({ en: `Investors funding · ${pct(f)}% raised`, pt: `Em captação · ${pct(f)}% captado` }), tone: "caution" };
    case "funded": return {
      label: tr({
        en: `Funded by ${f.investors} investor${f.investors === 1 ? "" : "s"}`,
        pt: `Captada com ${f.investors} ${f.investors === 1 ? "investidor" : "investidores"}`,
      }),
      tone: "positive",
    };
    case "refunded": return {
      label: f.refund_due
        ? tr({ en: "Investors being refunded", pt: "Investidores sendo reembolsados" })
        : tr({ en: "Investors refunded", pt: "Investidores reembolsados" }),
      tone: "neutral",
    };
    case "closed": return { label: tr({ en: "Closed · nothing was raised", pt: "Encerrada · nada foi captado" }), tone: "neutral" };
  }
}

export const pct = (f: DeskFunding) =>
  f.target_micro_usdc ? Math.min(100, Math.round((f.funded_micro_usdc / f.target_micro_usdc) * 100)) : 0;

/** Principal still owed: what was lent, less the principal part of what came back (flat schedule). */
export const outstandingCents = (l: DeskLoan) =>
  ["ACTIVE", "DISBURSED"].includes(l.status) ? Math.max(0, l.principal_cents - Math.round((l.principal_cents * l.paid) / l.term_months)) : 0;

/** A monthly rate in basis points: 2.17% a month, 2,17% ao mês. */
export const ratePercent = (bps: number) => formatNumber(bps / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const rate = (bps: number | null | undefined) =>
  bps === null || bps === undefined ? "—" : tr({ en: `${ratePercent(bps)}% a month`, pt: `${ratePercent(bps)}% ao mês` });

/**
 * A LOW / MEDIUM / HIGH grade as a word: "risk low", "readiness high". In
 * Portuguese the word agrees with its noun: risco baixo, prontidão baixa.
 */
export const level = (g: "LOW" | "MEDIUM" | "HIGH", gender: "m" | "f" = "m") =>
  tr({
    en: g.toLowerCase(),
    pt: { LOW: gender === "f" ? "baixa" : "baixo", MEDIUM: gender === "f" ? "média" : "médio", HIGH: gender === "f" ? "alta" : "alto" }[g],
  });

export const LIVE_LOAN: LoanStatus[] = ["DISBURSED", "ACTIVE", "PAID", "DEFAULTED"];
