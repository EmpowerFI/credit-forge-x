import type { AllocationReason, AllocationResult, PoolId } from "@empowerfi/capital-allocation";
import type { Tone } from "../components/product/StatusPill";
import { platform } from "./platform";
import type { Reality } from "./settlement";

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
}> = {
  domestic: {
    name: "Domestic P2P",
    route: "Domestic / Pix",
    investors: "Brazilian investors",
    asset: "Reais, a simulated pool",
    lastMile: "Pix, in reais",
    reality: "simulated",
    tone: "positive",
    bar: "bg-positive",
  },
  global: {
    name: "Global P2P",
    route: "Global / USDC",
    investors: "International and impact investors",
    asset: "Test USDC on Solana devnet",
    lastMile: "Regulated off-ramp, then Pix in reais",
    reality: "real",
    tone: "info",
    bar: "bg-info",
  },
};

/** What each reason code means, in a sentence an investor can read. */
export const REASON: Record<AllocationReason, { label: string; says: string; tone: Tone }> = {
  DOMESTIC_LOWEST_COST: { label: "Domestic costs her less", says: "Both pools could fund it; domestic capital costs her less a year.", tone: "positive" },
  DOMESTIC_LIQUIDITY_AVAILABLE: { label: "Domestic liquidity available", says: "The domestic pool has the capital, the risk appetite and the ticket for it.", tone: "positive" },
  DOMESTIC_POOL_EXHAUSTED: { label: "Domestic pool exhausted", says: "What the domestic pool has left is less than this request.", tone: "caution" },
  GLOBAL_EXPANDS_CAPACITY: { label: "Global expands capacity", says: "The domestic pool cannot take it; global capital funds a qualified opportunity that would otherwise wait.", tone: "info" },
  GLOBAL_IMPACT_MANDATE_MATCH: { label: "Impact mandate match", says: "The global pool holds a mandate for women-led businesses in verified communities, and this is one.", tone: "info" },
  GLOBAL_LOWER_REQUIRED_RETURN: { label: "Global costs her less", says: "Global investors ask a lower return, and it outweighs the FX hedge and the ramp.", tone: "info" },
  GLOBAL_FX_COST_DOMINATES: { label: "FX hedge outweighs", says: "Global investors ask less, but hedging reais over the loan takes the difference away.", tone: "neutral" },
  GLOBAL_RAMP_COST_DOMINATES: { label: "Ramp cost outweighs", says: "Global investors ask less, but converting in and out costs too much over a loan this short.", tone: "neutral" },
  GLOBAL_POOL_EXHAUSTED: { label: "Global pool exhausted", says: "What the global pool has left is less than this request.", tone: "caution" },
  RISK_BAND_NOT_ELIGIBLE: { label: "Risk band not eligible", says: "Its risk band is outside a pool's risk appetite.", tone: "caution" },
  TICKET_OUTSIDE_POOL_POLICY: { label: "Ticket outside policy", says: "The amount is outside a pool's ticket range.", tone: "caution" },
  PURPOSE_OUTSIDE_POOL_MANDATE: { label: "Purpose outside mandate", says: "The productive purpose is outside a pool's mandate.", tone: "caution" },
  NO_POOL_AVAILABLE: { label: "No pool available", says: "Neither pool can take it now; it waits for capital.", tone: "alert" },
};

/** The required disclaimer, word for word. */
export const PROTOTYPE_NOTICE =
  "Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.";

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
    liquidity_cents: number;
    liquidity_micro_usdc: number | null;
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
export const bpsPercent = (bps: number) => `${Number((bps / 100).toFixed(2)).toLocaleString("en-US")}%`;

/** Reais in thousands for hero tiles: 12630000 → "R$ 126.3k". */
export const reaisShort = (cents: number) => {
  const reais = cents / 100;
  return reais >= 1000 ? `R$ ${(reais / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : `R$ ${Math.round(reais).toLocaleString("en-US")}`;
};

/** USDC in thousands for hero tiles: 18240000000 → "18.2k USDC". */
export const usdcShort = (micro: number) => {
  const usdc = micro / 1e6;
  return usdc >= 1000 ? `${(usdc / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k USDC` : `${Math.round(usdc).toLocaleString("en-US")} USDC`;
};

/** A domestic position's reais: what was put in, or its USDC equivalent at the quote. */
export const positionReais = (amountCents: number | null | undefined, microUsdc: number, fxMilli: number | null | undefined) =>
  amountCents ?? (fxMilli ? Math.floor((microUsdc * fxMilli) / 10_000_000) : null);
