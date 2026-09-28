import { localized } from "../i18n";
import type { EvidenceLabel } from "./evidence";
import { platform } from "./platform";

// The nine stages between capital committed abroad and capital circulating in a
// territory (addendum v3 §7.3), as public.capital_journey() reads them.

export type StageKey =
  | "capital_exists"
  | "she_asks"
  | "engine_routes"
  | "investors_fund"
  | "position_minted"
  | "dollars_become_reais"
  | "disbursed"
  | "circulates"
  | "comes_back";

export interface AnchorTally {
  total: number;
  confirmed: number;
  pending: number;
  failed: number;
}

export interface Stage {
  no: number;
  key: StageKey;
  happened: boolean;
  amount_cents: number;
  count: number;
  evidence: EvidenceLabel;
  anchors: AnchorTally;
  /** Stage 3 only. */
  domestic_cents?: number;
  global_cents?: number;
  /** Stage 4 only. */
  micro_usdc?: number;
  refunded_cents?: number;
  /** Stage 5 only. */
  minted?: number;
  /** Stage 6 only. */
  saved_cents?: number;
  routes?: Record<string, number>;
  /** Stage 8 only. */
  onward_cents?: number;
  injected_cents?: number;
  /** Stage 9 only. */
  on_the_rail?: number;
}

export interface Journey {
  focus: {
    opportunity_id: string;
    code: string;
    amount_cents: number;
    purpose: string;
    status: string;
    funding_pool: string | null;
  } | null;
  fx_brl_per_usdc_milli: number;
  committed_cents: number;
  disbursed_cents: number;
  circulated_cents: number;
  stages: Stage[];
}

/** What each stage is, where it can be checked, and what its count counts. */
export const STAGE: Record<StageKey, { title: string; what: string; one: string; unit: string; to: string; toLabel: string }> =
  localized({
    capital_exists: {
      title: { en: "Capital exists", pt: "O capital existe" },
      what: {
        en: "Pools and partner lines the network can route to, with what each states it has.",
        pt: "Pools e linhas de parceiros para onde a rede pode encaminhar, com o que cada uma declara ter.",
      },
      one: { en: "route", pt: "rota" },
      unit: { en: "routes", pt: "rotas" },
      to: "/app/capital/network",
      toLabel: { en: "Capital Network", pt: "Rede de Capital" },
    },
    she_asks: {
      title: { en: "A business asks", pt: "Um negócio pede" },
      what: {
        en: "A request that passed readiness, affordability and eligibility — not merely a request.",
        pt: "Um pedido que passou por prontidão, capacidade de pagamento e elegibilidade — não apenas um pedido.",
      },
      one: { en: "qualified request", pt: "pedido qualificado" },
      unit: { en: "qualified requests", pt: "pedidos qualificados" },
      to: "/app/capital",
      toLabel: { en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" },
    },
    engine_routes: {
      title: { en: "The engine routes it", pt: "O motor a encaminha" },
      what: {
        en: "Domestic capital first, capital from abroad for the residual. A recommendation, not a drawdown.",
        pt: "Capital doméstico primeiro, capital de fora para o resíduo. Uma recomendação, não um desembolso.",
      },
      one: { en: "plan", pt: "plano" },
      unit: { en: "plans", pt: "planos" },
      to: "/app/capital/network#origin",
      toLabel: { en: "Where the capital came from", pt: "De onde veio o capital" },
    },
    investors_fund: {
      title: { en: "Investors put up the money", pt: "Investidores põem o dinheiro" },
      what: {
        en: "Each a share of one loan, in USDC. This is what actually funded it, and it can differ from what the plan recommended.",
        pt: "Cada um uma cota de um empréstimo, em USDC. É isto que de fato financiou, e pode diferir do que o plano recomendou.",
      },
      one: { en: "investor", pt: "investidor" },
      unit: { en: "investors", pt: "investidores" },
      to: "/app/investor/portfolio",
      toLabel: { en: "Investor Console", pt: "Console do Investidor" },
    },
    position_minted: {
      title: { en: "The share becomes an asset", pt: "A cota vira um ativo" },
      what: {
        en: "A tokenized position the investor holds, minted on Solana when a wallet claims it.",
        pt: "Uma posição tokenizada que o investidor detém, emitida na Solana quando uma carteira a reivindica.",
      },
      one: { en: "position", pt: "posição" },
      unit: { en: "positions", pt: "posições" },
      to: "/app/investor/assets",
      toLabel: { en: "Tokenised positions", pt: "Posições tokenizadas" },
    },
    dollars_become_reais: {
      title: { en: "Dollars become reais", pt: "Dólares viram reais" },
      what: {
        en: "The cheaper of two settlement routes, chosen against live quotes and recorded with its reasons.",
        pt: "A mais barata entre duas rotas de liquidação, escolhida contra cotações e registrada com seus motivos.",
      },
      one: { en: "settlement", pt: "liquidação" },
      unit: { en: "settlements", pt: "liquidações" },
      to: "/app/investor/settlement",
      toLabel: { en: "Settlement", pt: "Liquidação" },
    },
    disbursed: {
      title: { en: "The desk pays her", pt: "A mesa paga a ela" },
      what: {
        en: "The loan is formalised and disbursed by Pix. This is where the old story ended.",
        pt: "O empréstimo é formalizado e desembolsado por Pix. É aqui que a história antiga terminava.",
      },
      one: { en: "loan", pt: "empréstimo" },
      unit: { en: "loans", pt: "empréstimos" },
      to: "/app/partner/portfolio",
      toLabel: { en: "P2P desk", pt: "Mesa P2P" },
    },
    circulates: {
      title: { en: "And then what", pt: "E depois" },
      what: {
        en: "She buys her inputs inside the territory, and sells back into it. This is the stage the rest of the product did not have.",
        pt: "Ela compra os insumos dentro do território, e vende de volta para ele. Esta é a etapa que o resto do produto não tinha.",
      },
      one: { en: "merchant paid directly", pt: "comerciante pago diretamente" },
      unit: { en: "merchants paid directly", pt: "comerciantes pagos diretamente" },
      to: "/app/capital/local",
      toLabel: { en: "Local Economy", pt: "Economia Local" },
    },
    comes_back: {
      title: { en: "It comes back", pt: "Ele volta" },
      what: {
        en: "Instalments repaid, and the investor's return on the way to a wallet.",
        pt: "Parcelas pagas, e o retorno do investidor a caminho de uma carteira.",
      },
      one: { en: "instalment", pt: "parcela" },
      unit: { en: "instalments", pt: "parcelas" },
      to: "/app/partner/servicing",
      toLabel: { en: "Servicing", pt: "Acompanhamento" },
    },
  });

export const journeyKey = (opportunityId: string | null) =>
  ["platform", "capital-journey", opportunityId ?? "all"] as const;

export async function fetchJourney(opportunityId: string | null): Promise<Journey> {
  const { data, error } = await platform.rpc(
    "capital_journey",
    opportunityId ? { p_opportunity_id: opportunityId } : {},
  );
  if (error) throw error;
  return data as unknown as Journey;
}
