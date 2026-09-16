import { formatNumber, localized } from "../i18n";
import type { Database } from "./platform.types";

type Enums = Database["public"]["Enums"];
export type EligibilityDecision = Enums["eligibility_decision"];
export type LoanStatus = Enums["loan_status"];
export type OpportunityStatus = Enums["opportunity_status"];
export type CapitalUse = Enums["capital_use"];

// The eligibility engine's codes, and the loan's life, in words.

export const DECISION_LABEL: Record<EligibilityDecision, { title: string; tone: string }> = localized({
  ELIGIBLE: { title: { en: "Eligible", pt: "Elegível" }, tone: "tone-positive" },
  ELIGIBLE_REDUCED: { title: { en: "Eligible for a smaller amount", pt: "Elegível para um valor menor" }, tone: "tone-info" },
  MANUAL_REVIEW: { title: { en: "Under review", pt: "Em análise" }, tone: "tone-neutral" },
  NOT_ELIGIBLE: { title: { en: "Not eligible right now", pt: "Não elegível por enquanto" }, tone: "tone-caution" },
});

export const ELIGIBILITY_REASON: Record<string, string> = localized({
  AFFORDABLE: { en: "The instalment fits what the business makes", pt: "A parcela cabe no que o negócio ganha" },
  AMOUNT_ABOVE_CAPACITY: {
    en: "The amount asked is more than the business can repay; a smaller one fits",
    pt: "O valor pedido é maior do que o negócio consegue pagar; um valor menor cabe",
  },
  NOT_CREDIT_READY: { en: "Readiness comes first", pt: "A prontidão vem primeiro" },
  AMOUNT_OUTSIDE_PRODUCT_RANGE: { en: "The amount is outside the R$ 100–50,000 range", pt: "O valor está fora da faixa de R$ 100 a R$ 50.000" },
  NO_REPAYMENT_CAPACITY: { en: "After household expenses, nothing is left to repay from", pt: "Depois das despesas da casa, não sobra nada para pagar" },
  HIGH_RISK: { en: "Too many risk signals together", pt: "Sinais de risco demais ao mesmo tempo" },
  LOW_CONFIDENCE: { en: "Too little history for the rules to decide alone", pt: "Histórico pequeno demais para as regras decidirem sozinhas" },
  VOLATILE_INCOME: { en: "Sales vary a lot month to month", pt: "As vendas variam muito de um mês para outro" },
  DECLINING_REVENUE: { en: "Sales are falling", pt: "As vendas estão caindo" },
  HIGH_HOUSEHOLD_DRAW: { en: "Most of the profit goes to the household", pt: "A maior parte do lucro vai para as despesas da casa" },
  SHORT_HISTORY: { en: "Less than six months of history", pt: "Menos de seis meses de histórico" },
  TIGHT_AFFORDABILITY: { en: "The instalment takes over 20% of the monthly result", pt: "A parcela ocupa mais de 20% do resultado mensal" },
  LOW_READINESS_BAND: { en: "Readiness is on a low band", pt: "A prontidão está em uma faixa baixa" },
});

export const OPPORTUNITY_LABEL: Record<OpportunityStatus, string> = localized({
  in_review: { en: "Waiting for EmpowerFI's review", pt: "Aguardando a análise da EmpowerFI" },
  open: { en: "Waiting for capital", pt: "Aguardando capital" },
  referred: { en: "Open to P2P investors", pt: "Aberta a investidores P2P" },
  partner_approved: { en: "Approved by the P2P desk", pt: "Aprovada pela mesa P2P" },
  partner_declined: { en: "Declined by the P2P desk", pt: "Recusada pela mesa P2P" },
  withdrawn: { en: "Withdrawn", pt: "Retirada" },
});

export const LOAN_LABEL: Record<LoanStatus, string> = localized({
  DRAFT: { en: "Draft", pt: "Rascunho" },
  PARTNER_APPROVED: { en: "Approved", pt: "Aprovado" },
  DISBURSED: { en: "Disbursed", pt: "Desembolsado" },
  ACTIVE: { en: "Repaying", pt: "Em pagamento" },
  PAID: { en: "Paid off", pt: "Quitado" },
  DEFAULTED: { en: "Defaulted", pt: "Inadimplente" },
  CANCELLED: { en: "Cancelled", pt: "Cancelado" },
});

export const CAPITAL_USE_LABEL: Record<CapitalUse, string> = localized({
  as_declared: { en: "used as declared", pt: "usado como declarado" },
  partly_as_declared: { en: "partly as declared", pt: "em parte como declarado" },
  other_use: { en: "used for something else", pt: "usado para outra coisa" },
  not_reported: { en: "use not reported", pt: "uso não informado" },
});

/** The next steps EmpowerFI's P2P desk may take — the same state machine as the program. */
export const NEXT_STATUSES: Record<LoanStatus, LoanStatus[]> = {
  DRAFT: ["CANCELLED"],
  PARTNER_APPROVED: ["DISBURSED", "CANCELLED"],
  DISBURSED: ["ACTIVE"],
  ACTIVE: ["PAID", "DEFAULTED"],
  PAID: [],
  DEFAULTED: [],
  CANCELLED: [],
};

/** How the P2P desk sees a participant: a pseudonym, never a name. */
export const pseudonym = (entrepreneurId: string) => `P-${entrepreneurId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

export const percent = (bps: number | null | undefined) =>
  bps === null || bps === undefined
    ? "—"
    : `${formatNumber(bps / 100, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}%`;
