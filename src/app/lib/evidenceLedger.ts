import { localized } from "../i18n";
import type { EvidenceLabel } from "./evidence";
import { platform } from "./platform";

// What every number in this product is made of (addendum v3 §9), as
// public.evidence_ledger() derives it from the rows.

export type FamilyKey =
  | "business_months"
  | "readiness_and_eligibility"
  | "loans_and_instalments"
  | "pool_capital"
  | "partner_routes"
  | "settlement_quotes"
  | "fx_rates"
  | "cost_rates"
  | "solana_anchors"
  | "zcash_returns"
  | "local_rail";

export interface Family {
  key: FamilyKey;
  evidence: EvidenceLabel;
  rows: number;
  /** Of those rows, the ones that are not this prototype's own invention. */
  real_rows: number;
}

export interface EvidenceLedger {
  families: Family[];
  /** What the product as a whole may claim: its weakest family. */
  weakest: EvidenceLabel;
  observed_families: number;
  families_total: number;
}

/** Each family of figures, and where in the product it is read. */
export const FAMILY: Record<FamilyKey, { title: string; what: string; unit: string }> = localized({
  business_months: {
    title: { en: "The months a business reports", pt: "Os meses que um negócio informa" },
    what: {
      en: "Sales, costs and what she took out, entered as a monthly check-in. Everything downstream is at most as strong as this.",
      pt: "Vendas, custos e o que ela retirou, informados num check-in mensal. Tudo a jusante é no máximo tão forte quanto isto.",
    },
    unit: { en: "check-ins", pt: "check-ins" },
  },
  readiness_and_eligibility: {
    title: { en: "Readiness and eligibility", pt: "Prontidão e elegibilidade" },
    what: {
      en: "Scores the engines compute from those months. Derived, and never stronger than what went into them.",
      pt: "Pontuações que os motores calculam a partir desses meses. Derivadas, e nunca mais fortes que o que entrou nelas.",
    },
    unit: { en: "assessments", pt: "avaliações" },
  },
  loans_and_instalments: {
    title: { en: "Loans and instalments", pt: "Empréstimos e parcelas" },
    what: {
      en: "What was formalised, disbursed and repaid. No bank moved money for any of it.",
      pt: "O que foi formalizado, desembolsado e pago. Nenhum banco moveu dinheiro em nada disso.",
    },
    unit: { en: "loans", pt: "empréstimos" },
  },
  pool_capital: {
    title: { en: "Pool capital and policy", pt: "Capital e política dos pools" },
    what: {
      en: "What each P2P pool holds, the return it requires and the tickets it takes.",
      pt: "O que cada pool P2P tem, o retorno que exige e os tickets que aceita.",
    },
    unit: { en: "pools", pt: "pools" },
  },
  partner_routes: {
    title: { en: "What a partner route states it has", pt: "O que uma rota de parceiro declara ter" },
    what: {
      en: "A provider's own figure for its capacity. Nothing here checks it independently, which is exactly what “from a partner” means.",
      pt: "O número do próprio provedor para a capacidade dele. Nada aqui verifica isso de forma independente, que é justamente o que “de um parceiro” quer dizer.",
    },
    unit: { en: "providers", pt: "provedores" },
  },
  settlement_quotes: {
    title: { en: "Settlement quotes", pt: "Cotações de liquidação" },
    what: {
      en: "The rails that turn dollars into reais, and the prices they quote for doing it.",
      pt: "Os trilhos que transformam dólares em reais, e os preços que cotam para isso.",
    },
    unit: { en: "providers", pt: "provedores" },
  },
  fx_rates: {
    title: { en: "The exchange rate", pt: "A taxa de câmbio" },
    what: {
      en: "What a dollar is worth in reais. Observed where something recorded one from a source, and an assumption of this prototype until then.",
      pt: "Quanto vale um dólar em reais. Observada onde algo registrou uma de uma fonte, e uma premissa deste protótipo até lá.",
    },
    unit: { en: "rates recorded", pt: "taxas registradas" },
  },
  cost_rates: {
    title: { en: "What it costs to serve", pt: "Quanto custa servir" },
    what: {
      en: "Staff time, checks and rails, per business. The rate card names its own source.",
      pt: "Tempo de equipe, verificações e trilhos, por negócio. A tabela de custos nomeia a própria fonte.",
    },
    unit: { en: "rate cards", pt: "tabelas" },
  },
  solana_anchors: {
    title: { en: "Records anchored on Solana", pt: "Registros ancorados na Solana" },
    what: {
      en: "A confirmed anchor is a transaction that happened and that anyone can check. It proves when a record existed and that it has not changed — not that what the record says is true.",
      pt: "Uma âncora confirmada é uma transação que aconteceu e que qualquer um pode conferir. Ela prova quando um registro existiu e que ele não mudou — não que o que o registro diz seja verdade.",
    },
    unit: { en: "anchors", pt: "âncoras" },
  },
  zcash_returns: {
    title: { en: "Shielded returns", pt: "Retornos blindados" },
    what: {
      en: "Returns paid to an investor over Zcash, where the amount is nobody else's business.",
      pt: "Retornos pagos a um investidor via Zcash, onde o valor não é da conta de mais ninguém.",
    },
    unit: { en: "returns", pt: "retornos" },
  },
  local_rail: {
    title: { en: "The local productive capital rail", pt: "O trilho de capital produtivo local" },
    what: {
      en: "Units moving inside a territory. A clearly labelled sandbox: nothing is issued, nothing is custodied, and its own rows carry the label this reads.",
      pt: "Unidades se movendo dentro de um território. Um sandbox claramente rotulado: nada é emitido, nada é custodiado, e as próprias linhas carregam o rótulo que isto lê.",
    },
    unit: { en: "movements", pt: "movimentos" },
  },
});

export const evidenceKey = ["platform", "evidence-ledger"] as const;

export async function fetchEvidenceLedger(): Promise<EvidenceLedger> {
  const { data, error } = await platform.rpc("evidence_ledger");
  if (error) throw error;
  return data as unknown as EvidenceLedger;
}
