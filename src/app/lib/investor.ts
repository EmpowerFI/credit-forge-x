import type { Tone } from "../components/product/StatusPill";
import { localized, tr } from "../i18n";
import type { Database } from "./platform.types";
import { LOAN_LABEL, type LoanStatus } from "./credit";
import { PURPOSE_LABEL, sectorLabel, type CreditPurpose } from "./readiness";

// The investor console's vocabulary: opportunities as an investor sees them,
// positions, and how states read. No name anywhere — a code, a purpose and a
// sector.

type Fn = Database["public"]["Functions"];
export type MarketRow = Fn["investor_opportunities"]["Returns"][number];
export type FundingStatus = Database["public"]["Enums"]["funding_status"];
export type Grade = Database["public"]["Enums"]["grade"];
export type ActivityRow = Fn["investor_activity"]["Returns"][number];
export type ProofRow = Fn["investor_proofs"]["Returns"][number];

export interface Proof {
  kind: string;
  status: string;
  signature: string | null;
  account: string | null;
  commitment: string | null;
  reconcile: string | null;
  confirmed_at?: string | null;
}

export interface PortfolioRow {
  investment_id: string;
  opportunity_id: string;
  code: string;
  purpose: CreditPurpose;
  business_sector: string | null;
  risk_band: Grade;
  amount_micro_usdc: number;
  share_bps: number;
  mode: "wallet" | "cloak" | "simulated" | "zcash";
  status: "allocated" | "refund_due" | "refunded";
  deposit_signature: string | null;
  invested_at: string;
  is_simulated: boolean;
  funding_status: FundingStatus;
  loan_status: LoanStatus | null;
  term_months: number;
  paid: number;
  disbursed_at: string | null;
  repaid_micro_usdc: number;
  evc_cents: number | null;
  proof: { status: string | null; signature: string | null; reconcile: string | null };
  funding_pool: "domestic" | "global" | null;
  amount_cents: number | null;
  fx_brl_per_usdc_milli: number | null;
}

export interface Portfolio {
  invested_micro_usdc: number;
  deployed_micro_usdc: number;
  repaid_micro_usdc: number;
  expected_micro_usdc: number;
  positions: number;
  by_risk: Partial<Record<Grade, number>>;
  rows: PortfolioRow[];
}

export const FUNDING_LABEL: Record<FundingStatus, { label: string; tone: Tone }> = localized({
  open: { label: { en: "Open", pt: "Aberta" }, tone: "info" },
  partially_funded: { label: { en: "Partially funded", pt: "Parcialmente captada" }, tone: "caution" },
  funded: { label: { en: "Funded", pt: "Captada" }, tone: "positive" },
  closed: { label: { en: "Closed", pt: "Encerrada" }, tone: "neutral" },
  refunded: { label: { en: "Refunded", pt: "Reembolsada" }, tone: "neutral" },
});

/** Risk bands read as grades, the way credit investors expect them. */
export const RISK: Record<Grade, { grade: string; label: string; tone: Tone; bar: string }> = localized({
  LOW: { grade: "A", label: { en: "A · lower risk", pt: "A · risco menor" }, tone: "positive", bar: "bg-positive" },
  MEDIUM: { grade: "B", label: { en: "B · moderate", pt: "B · moderado" }, tone: "info", bar: "bg-info" },
  HIGH: { grade: "C", label: { en: "C · higher", pt: "C · maior" }, tone: "caution", bar: "bg-caution" },
});

export const title = (purpose: CreditPurpose, sector: string | null) =>
  `${PURPOSE_LABEL[purpose]}${sector ? ` · ${sectorLabel(sector)}` : ""}`;

/** Share of a target already raised, 0–100. */
export const fundedPercent = (funded: number, target: number | null) =>
  target && target > 0 ? Math.min(100, Math.round((funded / target) * 100)) : 0;

export const reaisFromUsdc = (micro: number, fxMilli: number | null) =>
  fxMilli ? Math.round((micro / 1e6) * (fxMilli / 1000) * 100) : null; // centavos

/** Centavos to micro-USDC at a quote in milli-reais per USDC; mirrors private.usdc_micro. */
export const usdcFromReais = (cents: number, fxMilli: number) => (cents * 1e7) / fxMilli;

export const ACTIVITY_LABEL: Record<string, string> = localized({
  invested: { en: "Investment allocated", pt: "Investimento alocado" },
  disbursed: { en: "Loan disbursed", pt: "Empréstimo desembolsado" },
  repayment: { en: "Repayment received", pt: "Pagamento recebido" },
  paid_off: { en: "Loan paid off", pt: "Empréstimo quitado" },
  outcome: { en: "Outcome measured", pt: "Resultado medido" },
  refund_due: { en: "Refund due", pt: "Reembolso pendente" },
});

export const PROOF_LABEL: Record<string, string> = localized({
  allocation: { en: "Your allocation", pt: "Sua alocação" },
  loan: { en: "Loan terms", pt: "Condições do empréstimo" },
  loan_transition: { en: "Loan status change", pt: "Mudança de status do empréstimo" },
  payment: { en: "Instalment paid", pt: "Parcela paga" },
  readiness: { en: "Readiness attestation", pt: "Atestado de prontidão" },
  eligibility: { en: "Eligibility commitment", pt: "Hash da elegibilidade" },
  opportunity: { en: "Opportunity commitment", pt: "Hash da oportunidade" },
  consent: { en: "Her consent to be shown", pt: "O consentimento dela para ser exibida" },
});

/** Where a position stands, in one pill: raising, the loan's state, or a refund. */
export function positionState(r: Pick<PortfolioRow, "status" | "loan_status" | "funding_status">): { label: string; tone: Tone } {
  if (r.status !== "allocated") {
    return {
      label: r.status === "refund_due" ? tr({ en: "Refund due", pt: "Reembolso pendente" }) : tr({ en: "Refunded", pt: "Reembolsada" }),
      tone: "caution",
    };
  }
  if (!r.loan_status || r.loan_status === "PARTNER_APPROVED" || r.loan_status === "DRAFT") {
    return r.funding_status === "funded" ? { label: tr({ en: "Funded · awaiting disbursement", pt: "Captada · aguardando desembolso" }), tone: "info" } : FUNDING_LABEL[r.funding_status];
  }
  const tone: Record<string, Tone> = { DISBURSED: "info", ACTIVE: "positive", PAID: "positive", DEFAULTED: "alert", CANCELLED: "neutral" };
  return { label: LOAN_LABEL[r.loan_status], tone: tone[r.loan_status] ?? "neutral" };
}
