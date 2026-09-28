import type { AllocationReason, AllocationResult, PoolId } from "@empowerfi/capital-allocation";
import type { Tone } from "../components/product/StatusPill";
import { platform } from "./platform";
import type { Reality } from "./settlement";
import { formatNumber, localized, tr } from "../i18n";

// P2P capital in two pools, and the engine that chooses between them for each
// qualified opportunity. Domestic P2P is Brazilian investors' capital in
// reais; Global P2P is international investors' USDC on Solana. Either way she
// receives and repays in reais, by Pix.

export type { AllocationReason, PoolId };

export const POOL: Record<PoolId, {
  name: string;
  route: string;
  investors: string;
  asset: string;
  lastMile: string;
  reality: Reality;
  tone: Tone;
  bar: string;
}> = localized({
  domestic: {
    name: { en: "Domestic P2P", pt: "P2P Doméstico" },
    route: { en: "Domestic / Pix", pt: "Doméstico / Pix" },
    investors: { en: "Brazilian investors", pt: "Investidores brasileiros" },
    asset: { en: "Reais, a simulated pool", pt: "Reais, um pool simulado" },
    lastMile: { en: "Pix, in reais", pt: "Pix, em reais" },
    reality: "simulated",
    tone: "positive",
    bar: "bg-positive",
  },
  global: {
    name: { en: "Global P2P", pt: "P2P Global" },
    route: { en: "Global / USDC", pt: "Global / USDC" },
    investors: { en: "International and impact investors", pt: "Investidores internacionais e de impacto" },
    asset: { en: "Test USDC on Solana devnet", pt: "USDC de teste na devnet da Solana" },
    lastMile: { en: "Regulated off-ramp, then Pix in reais", pt: "Off-ramp regulado, depois Pix em reais" },
    reality: "real",
    tone: "info",
    bar: "bg-info",
  },
});

/** What each reason code means, in a sentence an investor can read. */
export const REASON: Record<AllocationReason, { label: string; says: string; tone: Tone }> = localized({
  DOMESTIC_LOWEST_COST: {
    label: { en: "Domestic costs her less", pt: "O doméstico custa menos para ela" },
    says: { en: "Both pools could fund it; domestic capital costs her less a year.", pt: "Os dois pools poderiam financiá-la; o capital doméstico custa menos para ela ao ano." },
    tone: "positive",
  },
  DOMESTIC_LIQUIDITY_AVAILABLE: {
    label: { en: "Domestic liquidity available", pt: "Liquidez doméstica disponível" },
    says: { en: "The domestic pool has the capital, the risk appetite and the ticket for it.", pt: "O pool doméstico tem o capital, o apetite a risco e o ticket para ela." },
    tone: "positive",
  },
  DOMESTIC_POOL_EXHAUSTED: {
    label: { en: "Domestic pool exhausted", pt: "Pool doméstico esgotado" },
    says: { en: "What the domestic pool has left is less than this request.", pt: "O que resta no pool doméstico é menos do que este pedido." },
    tone: "caution",
  },
  GLOBAL_EXPANDS_CAPACITY: {
    label: { en: "Global expands capacity", pt: "O global amplia a capacidade" },
    says: { en: "The domestic pool cannot take it; global capital funds a qualified opportunity that would otherwise wait.", pt: "O pool doméstico não consegue atendê-la; o capital global financia uma oportunidade qualificada que, sem ele, ficaria esperando." },
    tone: "info",
  },
  GLOBAL_IMPACT_MANDATE_MATCH: {
    label: { en: "Impact mandate match", pt: "Dentro do mandato de impacto" },
    says: { en: "The global pool holds a mandate for women-led businesses in verified communities, and this is one.", pt: "O pool global tem um mandato para negócios liderados por mulheres em comunidades verificadas, e este é um deles." },
    tone: "info",
  },
  GLOBAL_LOWER_REQUIRED_RETURN: {
    label: { en: "Global costs her less", pt: "O global custa menos para ela" },
    says: { en: "Global investors ask a lower return, and it outweighs the FX hedge and the ramp.", pt: "Investidores globais exigem um retorno menor, e isso compensa o hedge cambial e a rampa." },
    tone: "info",
  },
  GLOBAL_FX_COST_DOMINATES: {
    label: { en: "FX hedge outweighs", pt: "O hedge cambial pesa mais" },
    says: { en: "Global investors ask less, but hedging reais over the loan takes the difference away.", pt: "Investidores globais pedem menos, mas o hedge dos reais durante o empréstimo anula a diferença." },
    tone: "neutral",
  },
  GLOBAL_RAMP_COST_DOMINATES: {
    label: { en: "Ramp cost outweighs", pt: "O custo da rampa pesa mais" },
    says: { en: "Global investors ask less, but converting in and out costs too much over a loan this short.", pt: "Investidores globais pedem menos, mas converter na entrada e na saída custa caro demais para um empréstimo tão curto." },
    tone: "neutral",
  },
  GLOBAL_POOL_EXHAUSTED: {
    label: { en: "Global pool exhausted", pt: "Pool global esgotado" },
    says: { en: "What the global pool has left is less than this request.", pt: "O que resta no pool global é menos do que este pedido." },
    tone: "caution",
  },
  RISK_BAND_NOT_ELIGIBLE: {
    label: { en: "Risk band not eligible", pt: "Faixa de risco não elegível" },
    says: { en: "Its risk band is outside a pool's risk appetite.", pt: "A faixa de risco dela está fora do apetite a risco de um pool." },
    tone: "caution",
  },
  TICKET_OUTSIDE_POOL_POLICY: {
    label: { en: "Ticket outside policy", pt: "Ticket fora da política" },
    says: { en: "The amount is outside a pool's ticket range.", pt: "O valor está fora da faixa de ticket de um pool." },
    tone: "caution",
  },
  PURPOSE_OUTSIDE_POOL_MANDATE: {
    label: { en: "Purpose outside mandate", pt: "Finalidade fora do mandato" },
    says: { en: "The productive purpose is outside a pool's mandate.", pt: "A finalidade produtiva está fora do mandato de um pool." },
    tone: "caution",
  },
  NO_POOL_AVAILABLE: {
    label: { en: "No pool available", pt: "Nenhum pool disponível" },
    says: { en: "Neither pool can take it now; it waits for capital.", pt: "Nenhum dos pools pode atendê-la agora; ela aguarda capital." },
    tone: "alert",
  },
});

/**
 * What a pool's figure is, wherever one is shown. It is the most misreadable
 * number on these screens: two bars draining look like a treasury being spent,
 * and there is no treasury. A pool is how much capital has declared itself
 * willing to lend through this desk — the constraint that lets the second
 * engine answer "waiting for capital" instead of assuming money is always
 * there. The money itself never sits here.
 */
export const poolCapacityNote = () => tr({
  en: "A pool is declared capacity, not custody: EmpowerFI holds no one's money. It is what capital has said it will lend through this desk, less what is already lent, and it exists so the engine can answer \"waiting for capital\" rather than assume there is always more. Money moves only when an investor funds one named opportunity — test USDC on Devnet for the global pool, simulated reais for the domestic one — and it moves into the vault, not into a pool. Both figures are pilot assumptions.",
  pt: "Um pool é capacidade declarada, não custódia: a EmpowerFI não guarda o dinheiro de ninguém. É o quanto o capital disse que empresta por esta mesa, menos o que já está emprestado, e existe para que o motor possa responder \"aguardando capital\" em vez de supor que sempre há mais. O dinheiro só se move quando uma investidora financia uma oportunidade específica — USDC de teste na Devnet no pool global, reais simulados no doméstico — e se move para o cofre, não para um pool. Os dois valores são premissas do piloto.",
});

/**
 * The required disclaimer, word for word, in English. A plain string cannot
 * change language: where it is shown, render prototypeNotice().
 */
export const PROTOTYPE_NOTICE =
  "Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.";

/** The required disclaimer, word for word, in the current language. */
export const prototypeNotice = () =>
  tr({
    en: PROTOTYPE_NOTICE,
    pt: "Protótipo de uma futura arquitetura regulada de crédito produtivo P2P. Investimentos, retornos, câmbio e liquidação via Pix do hackathon são simulados; as transações em blockchain usam ativos de teste na Devnet.",
  });

export interface PoolPolicyView {
  id: PoolId;
  required_return_bps: number;
  eligible_risk_bands: ("LOW" | "MEDIUM" | "HIGH")[];
  min_ticket_cents: number;
  max_ticket_cents: number;
  purposes: string[];
  impact_mandate: boolean;
  fx_hedge_bps: number;
  ramp_bps: number;
}

export interface CapitalOverview {
  model_version: string;
  fx_brl_per_usdc_milli: number;
  expected_loss_bps: Record<"LOW" | "MEDIUM" | "HIGH", number>;
  cost_to_serve_bps: number;
  pools: {
    pool: PoolId;
    name: string;
    is_simulated: boolean;
    policy: PoolPolicyView;
    capital_cents: number;
    capital_micro_usdc: number | null;
    lent: number;
    claimed: number;
    /** Capital less what is lent: capacity against demand counted whole. */
    liquidity_cents: number;
    liquidity_micro_usdc: number | null;
    /** Capital less what is lent and less what is claimed: what may still be allocated. */
    available_cents: number;
    available_micro_usdc: number | null;
  }[];
  coverage: {
    demand_cents: number;
    domestic_only_cents: number;
    combined_cents: number;
    domestic_coverage_bps: number;
    combined_coverage_bps: number;
  };
  demand: {
    opportunity_id: string;
    code: string;
    amount_cents: number;
    term_months: number;
    risk_band: "LOW" | "MEDIUM" | "HIGH";
    purpose: string;
    impact_eligible: boolean;
    funding_pool: PoolId | null;
    funding_status: string | null;
    reason_codes: AllocationReason[] | null;
  }[];
}

export const capitalOverviewKey = ["platform", "capital-overview"] as const;

export async function fetchCapitalOverview(): Promise<CapitalOverview> {
  const { data, error } = await platform.rpc("capital_overview");
  if (error) throw error;
  return data as unknown as CapitalOverview;
}

/** The engine's answer as the database kept it on the opportunity. */
export type StoredAllocation = AllocationResult;

export const poolOf = (p: string | null | undefined): PoolId | null => (p === "domestic" || p === "global" ? p : null);

/** Basis points as a percentage with up to two decimals: 3800 → "38%", 1650 → "16.5%". */
export const bpsPercent = (bps: number) => `${formatNumber(Number((bps / 100).toFixed(2)))}%`;

const thousands = () => tr({ en: "k", pt: " mil" });

/** Reais in thousands for hero tiles: 12630000 → "R$ 126.3k", "R$ 126,3 mil". */
export const reaisShort = (cents: number) => {
  const reais = cents / 100;
  return reais >= 1000 ? `R$ ${formatNumber(reais / 1000, { maximumFractionDigits: 1 })}${thousands()}` : `R$ ${formatNumber(Math.round(reais))}`;
};

/** USDC in thousands for hero tiles: 18240000000 → "18.2k USDC", "18,2 mil USDC". */
export const usdcShort = (micro: number) => {
  const usdc = micro / 1e6;
  return usdc >= 1000 ? `${formatNumber(usdc / 1000, { maximumFractionDigits: 1 })}${thousands()} USDC` : `${formatNumber(Math.round(usdc))} USDC`;
};

/** A domestic position's reais: what was put in, or its USDC equivalent at the quote. */
export const positionReais = (amountCents: number | null | undefined, microUsdc: number, fxMilli: number | null | undefined) =>
  amountCents ?? (fxMilli ? Math.floor((microUsdc * fxMilli) / 10_000_000) : null);
