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
  /** Stage 9 only: what those instalments released, on its way to the investor. */
  from_the_rail_cents?: number;
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
      to: "/app/capital/engine",
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
      title: { en: "It comes back as stablecoin", pt: "Ele volta como stablecoin" },
      what: {
        en: "Her instalment in local units returns to the treasury and releases exactly the reais behind it — and those reais are what the investor is paid out of.",
        pt: "A parcela dela em unidades locais volta para a tesouraria e libera exatamente os reais que estavam atrás dela — e são esses reais que pagam o investidor.",
      },
      one: { en: "instalment", pt: "parcela" },
      unit: { en: "instalments", pt: "parcelas" },
      to: "/app/partner/servicing",
      toLabel: { en: "Servicing", pt: "Acompanhamento" },
    },
  });

// ---------------------------------------------------------------- movements

// The nine stages are the evidence; four movements are the argument. Read on
// their own the stages are a list, and a list is what made the area read as
// four disconnected screens. Grouped, they say one thing: capital that exists
// abroad as a dollar comes in, becomes productive credit in the currency she
// trades in, circulates where she lives, and comes back as a dollar.
//
// The grouping is deliberately lopsided. Five of the nine stages happen before
// a single real exists, and they are the five a conventional fund also runs;
// the four that follow are the ones this product exists for. Balancing the
// bands would hide exactly that.

export type MovementKey = "comes_in" | "becomes_credit" | "circulates" | "comes_back";

/** What each movement claims, which stages carry it, and the money that got
 * through it. The type is inferred rather than annotated: a contextual type
 * over a localized() call stops its { en, pt } leaves from resolving. */
export const MOVEMENT = localized({
  comes_in: {
    no: 1,
    title: { en: "Global capital comes in", pt: "O capital global entra" },
    claim: {
      en: "Dollars that exist outside Brazil are committed to one named, qualified request. Every stage in this movement is one a conventional fund also runs — which is the point: nothing here is the differentiator.",
      pt: "Dólares que existem fora do Brasil são comprometidos com um pedido nomeado e qualificado. Toda etapa deste movimento é uma que um fundo convencional também roda — e é esse o ponto: nada aqui é o diferencial.",
    },
    stages: ["capital_exists", "she_asks", "engine_routes", "investors_fund", "position_minted"],
    // What investors actually put into requests, not what the book has pledged
    // or what the routes declare they could carry. The spine has to be one
    // quantity narrowing four times; a headline that counted capacity here
    // would not be the same money as the one in the next movement.
    figure: (j) => j.stages.find((s) => s.key === "investors_fund")?.amount_cents ?? 0,
    figureHint: { en: "put up by investors", pt: "postos por investidores" },
  },
  becomes_credit: {
    no: 2,
    title: { en: "It becomes credit in local currency", pt: "Vira crédito em moeda local" },
    claim: {
      en: "The dollars are converted once, by the desk, on the cheaper of two priced routes — and she receives her whole principal in the currency she trades in. She never holds a dollar and never owes one; the currency risk stays with the pool that chose to take it.",
      pt: "Os dólares são convertidos uma vez, pela mesa, pela mais barata de duas rotas precificadas — e ela recebe todo o principal na moeda em que ela negocia. Ela nunca tem dólar nem deve em dólar; o risco cambial fica com o pool que escolheu assumi-lo.",
    },
    stages: ["dollars_become_reais", "disbursed"],
    figure: (j) => j.disbursed_cents,
    figureHint: { en: "reached a business", pt: "chegaram a um negócio" },
  },
  circulates: {
    no: 3,
    title: { en: "It circulates in the territory", pt: "Circula no território" },
    claim: {
      en: "What she spends is spent where she lives, and it can be counted rather than assumed. This is the movement the old story did not have: it ended one stage earlier, at the disbursal, and called that impact.",
      pt: "O que ela gasta é gasto onde ela vive, e dá para contar em vez de supor. Este é o movimento que a história antiga não tinha: ela terminava uma etapa antes, no desembolso, e chamava aquilo de impacto.",
    },
    stages: ["circulates"],
    // Her trade, and not the territory's. The onward hops between merchants
    // happen in the same place and are shown on the stage card, but a balance
    // is commingled the moment a second customer pays into it, so adding them
    // here would inflate the spine with money that is no longer traceably hers.
    figure: (j) => j.stages.find((s) => s.key === "circulates")?.amount_cents ?? 0,
    figureHint: { en: "she traded inside the territory", pt: "ela negociou dentro do território" },
  },
  comes_back: {
    no: 4,
    title: { en: "It comes back as stablecoin", pt: "Volta como stablecoin" },
    claim: {
      en: "Her instalment in local units returns to the treasury and releases exactly the reais that were held behind it — and those reais are what the investor is paid out of. The loop closes or it does not; there is no third answer.",
      pt: "A parcela dela em unidades locais volta para a tesouraria e libera exatamente os reais que estavam guardados atrás dela — e são esses reais que pagam o investidor. O laço fecha ou não fecha; não existe terceira resposta.",
    },
    stages: ["comes_back"],
    figure: (j) => j.stages.find((s) => s.key === "comes_back")?.amount_cents ?? 0,
    figureHint: { en: "repaid by businesses", pt: "pagos pelos negócios" },
  },
});

export const MOVEMENTS: MovementKey[] = ["comes_in", "becomes_credit", "circulates", "comes_back"];

/**
 * The six stages after the allocation decision, in the order the money took
 * them. The engine page replays these as its third act: the two engines stop at
 * the decision, which is where a conventional fund's screen also stops, and
 * these are the hops that come after it.
 */
export const FOLLOWED: StageKey[] = [
  "investors_fund",
  "position_minted",
  "dollars_become_reais",
  "disbursed",
  "circulates",
  "comes_back",
];

/** One tick a stage, so the act's length is the ledger's and not a designer's. */
export const FOLLOW_TICKS = FOLLOWED.length;

/** Where the money changes country and currency: everything from this row on is
 * inside the territory. */
export const CROSSES_AT = FOLLOWED.indexOf("dollars_become_reais");

// ------------------------------------------------------------- the picker

/** How far a request actually got, which is what orders the picker. */
export type Reached = "looped" | "rail" | "disbursed" | "funded" | "raising" | "waiting";

export interface JourneyOpportunity {
  opportunity_id: string;
  code: string;
  amount_cents: number;
  purpose: string;
  reached: Reached;
}

/** Said on the option itself, because a picker that hides how far a request got
 * invites following one that never left the first movement. */
export const REACHED: Record<Reached, string> = localized({
  looped: { en: "the whole loop", pt: "o laço inteiro" },
  rail: { en: "on the local rail", pt: "no trilho local" },
  disbursed: { en: "disbursed", pt: "desembolsado" },
  funded: { en: "funded, not yet disbursed", pt: "captada, ainda não desembolsada" },
  raising: { en: "still raising", pt: "ainda captando" },
  waiting: { en: "waiting for capital", pt: "aguardando capital" },
});

export const journeyOpportunitiesKey = ["platform", "journey-opportunities"] as const;

export async function fetchJourneyOpportunities(): Promise<JourneyOpportunity[]> {
  const { data, error } = await platform.rpc("journey_opportunities");
  if (error) throw error;
  return data as unknown as JourneyOpportunity[];
}

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
