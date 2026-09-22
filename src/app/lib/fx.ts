import { platform } from "./platform";

// What USDC is worth in reais, as the market says and the platform records it
// (public.fx_rates, filled by the fx-quote function every ten minutes).
//
// Two pairs, and the distance between them is worth seeing: USDC/BRL from
// Mercado Bitcoin is the price at which USDC actually becomes reais in Brazil;
// USD/BRL is the Banco Central's PTAX, the official rate, as the reference. A
// feed that stopped is not a rate, so the database falls back to its stated
// assumption and `in_use_source` says "assumed".

export type FxPair = "USDC/BRL" | "USD/BRL";
export type FxSource = "mercado_bitcoin" | "bcb_ptax" | "awesomeapi";

export interface FxRate {
  pair: FxPair;
  source: FxSource;
  bid_milli: number;
  ask_milli: number;
  mid_milli: number;
  observed_at: string;
  age_seconds: number;
  fresh: boolean;
}

export interface FxMarket {
  rates: FxRate[];
  /** The rate everything in reais is priced at right now. */
  in_use_milli: number;
  in_use_source: "observed" | "assumed";
  /** What it falls back to when nothing was observed recently. */
  fallback_milli: number;
  max_age_seconds: number;
}

export const fxMarketKey = ["platform", "fx-market"] as const;

export async function fetchFxMarket(): Promise<FxMarket> {
  const { data, error } = await platform.rpc("fx_market");
  if (error) throw error;
  return data as unknown as FxMarket;
}

export const fxRate = (m: FxMarket | undefined, pair: FxPair) => m?.rates.find((r) => r.pair === pair);

/** Where a price came from, in the words the screens use. */
export const FX_SOURCE_NAME: Record<FxSource, string> = {
  mercado_bitcoin: "Mercado Bitcoin",
  bcb_ptax: "Banco Central · PTAX",
  awesomeapi: "AwesomeAPI",
};
