// Settlement Route Comparator, v1 — "her loan is in reais: which way do the
// dollars become those reais, and what does each way deliver?"
//
// Runs after the Capital Allocation Engine has chosen the global pool, and
// before she is paid. Investors fund in USDC; she receives and repays in reais
// by Pix either way. Two ways exist to get from one to the other:
//
//   Direct        USDC → off-ramp (FX struck at payout) → Pix
//   BRL stable    USDC → BRL stablecoin (FX struck at allocation) → 1:1 → Pix
//
// The difference is not only a hop. It is where the exchange rate is struck: a
// BRL stablecoin locks the principal in reais early and its payout leg carries
// no FX at all, at the cost of one more conversion. Whether that trade is worth
// taking depends on the fees, the rate and the ticket — which is what this
// compares. It never prefers a stablecoin for being on chain.
//
// It is not a credit decision and not a capital decision: eligibility said the
// amount fits the business, allocation said which pool funds it. This says how
// the money travels.
//
// Deterministic, versioned, integers only (micro-USDC, centavos, basis points,
// seconds) and no clock of its own — the caller passes `now`. The database runs
// the same rules (private.settle_route); vectors/scenarios.json holds them both
// to one answer, and the browser re-runs it.
//
// The addendum's §6 variables map to these fields:
//   gross_usdc → gross_micro_usdc      fx_rate → fx_rate_milli
//   fx_spread_bps → fx_spread_bps      provider_fee_brl → provider_fee_cents
//   network_fee_brl → network_fee_cents
//   net_brl_to_business → net_brl_cents
//   execution_eta_sec, quote_ttl_sec, liquidity_ok → the same
//   sandbox_or_simulated → reality

export const SETTLEMENT_ROUTE_MODEL_VERSION = "settlement-route-v1.0.0";

export type SettlementRoute = "direct_usdc_pix" | "brl_stable_pix";

/** What a leg of a route really is, so no demo claims more than it did. */
export type QuoteReality = "sandbox" | "devnet" | "test" | "simulated";

export type RouteReason =
  | "DIRECT_LOWEST_COST"
  | "DIRECT_FEWEST_STEPS"
  | "BRL_STABLE_BETTER_NET_BRL"
  | "BRL_STABLE_LOCKS_PRINCIPAL_EARLIER"
  | "BRL_STABLE_NO_FX_ON_PAYOUT"
  | "EXTRA_CONVERSION_ADDS_COST"
  | "ROUTE_QUOTE_EXPIRED"
  | "ROUTE_NO_LIQUIDITY"
  | "ROUTE_TICKET_OUTSIDE_POLICY"
  | "ROUTE_PROVIDER_UNAVAILABLE"
  | "NO_ROUTE_AVAILABLE";

/** Where the exchange rate is struck, which is what the two routes really differ on. */
export type FxStruck = "allocation" | "payout";

/** A provider's rate card: an assumption in this prototype, held as data so another provider needs no code. */
export interface RouteProvider {
  route: SettlementRoute;
  provider: string;
  asset: "USDC" | "BRS";
  /** The spread on the USDC → reais conversion, wherever that conversion happens. */
  fx_spread_bps: number;
  /** Where the rate is struck: 'allocation' locks the reais before disbursement. */
  fx_struck: FxStruck;
  /** The provider's fee over the converted amount, every leg of the route together. */
  provider_fee_bps: number;
  provider_fee_fixed_cents: number;
  /** Network, account and gas costs, stated even when the provider sponsors them. */
  network_fee_cents: number;
  execution_eta_sec: number;
  quote_ttl_sec: number;
  min_ticket_cents: number;
  max_ticket_cents: number;
  /** What the route can settle right now, in reais. */
  liquidity_cents: number;
  reality: QuoteReality;
  enabled: boolean;
}

/** One provider's card, priced at one rate, at one moment. */
export interface QuoteRequest {
  provider: RouteProvider;
  /** Milli-reais per USDC: 5400 is R$ 5,40. A locked route carries the rate it locked. */
  fx_rate_milli: number;
  /** ISO 8601. A route that locked its rate earlier quotes from earlier. */
  quoted_at: string;
}

export interface RouteQuote {
  route: SettlementRoute;
  provider: string;
  asset: "USDC" | "BRS";
  gross_micro_usdc: number;
  fx_rate_milli: number;
  fx_struck: FxStruck;
  fx_spread_bps: number;
  /** Reais the gross is worth at the quoted rate, before any cost. */
  gross_brl_cents: number;
  fx_cost_cents: number;
  provider_fee_cents: number;
  network_fee_cents: number;
  /** What reaches her Pix: the addendum's net_brl_to_business. */
  net_brl_cents: number;
  total_cost_cents: number;
  /** Every cost together, over the gross, in basis points. */
  cost_bps: number;
  execution_eta_sec: number;
  quote_ttl_sec: number;
  quoted_at: string;
  expires_at: string;
  liquidity_ok: boolean;
  reality: QuoteReality;
  /** Conversions between the investor's USDC and her Pix. Direct has one, a stablecoin route has two. */
  hops: number;
  feasible: boolean;
  /** Why it cannot settle this ticket, empty when it can. */
  blocks: RouteReason[];
}

export interface SettlementRouteResult {
  model_version: string;
  selected: SettlementRoute | null;
  reason_codes: RouteReason[];
  /** Both routes, always, in a stable order: direct first. */
  quotes: RouteQuote[];
  /** The gross both were priced at, so their net reais are comparable. */
  compared_gross_micro_usdc: number;
  /** Reais the selected route delivers over the other, on that gross; null unless both were feasible. */
  net_brl_delta_cents: number | null;
  /** Her contracted principal, which she receives whole whichever route pays it. */
  principal_cents: number | null;
  /** USDC the vault must release for that principal to arrive, by route; null where the route cannot settle it. */
  gross_for_principal: Partial<Record<SettlementRoute, number | null>>;
}

/** Conversions between the investor's USDC and her Pix, by route. */
export const ROUTE_HOPS: Record<SettlementRoute, number> = { direct_usdc_pix: 1, brl_stable_pix: 2 };

const REASON_ORDER: RouteReason[] = [
  "DIRECT_LOWEST_COST",
  "DIRECT_FEWEST_STEPS",
  "BRL_STABLE_BETTER_NET_BRL",
  "BRL_STABLE_LOCKS_PRINCIPAL_EARLIER",
  "BRL_STABLE_NO_FX_ON_PAYOUT",
  "EXTRA_CONVERSION_ADDS_COST",
  "ROUTE_QUOTE_EXPIRED",
  "ROUTE_NO_LIQUIDITY",
  "ROUTE_TICKET_OUTSIDE_POLICY",
  "ROUTE_PROVIDER_UNAVAILABLE",
  "NO_ROUTE_AVAILABLE",
];

/**
 * Micro-USDC in centavos at a quote (milli-reais per USDC), rounded down.
 * The same rounding as the capital allocation engine's usdcToCents: a loan
 * priced one way and settled another would not add up.
 */
export function centsFromMicroUsdc(microUsdc: number, fxMilli: number): number {
  return Math.floor((microUsdc * fxMilli) / 10_000_000);
}

const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const isoFrom = (iso: string, plusSec: number) => new Date((seconds(iso) + plusSec) * 1000).toISOString();

/** What reaches her Pix out of a gross, under one rate card at one rate. */
export function netCents(grossMicroUsdc: number, fxMilli: number, p: RouteProvider): number {
  const gross = centsFromMicroUsdc(grossMicroUsdc, fxMilli);
  const afterFx = Math.floor((gross * (10_000 - p.fx_spread_bps)) / 10_000);
  const fee = Math.ceil((afterFx * p.provider_fee_bps) / 10_000) + p.provider_fee_fixed_cents;
  return Math.max(0, afterFx - fee - p.network_fee_cents);
}

/**
 * The smallest gross in micro-USDC whose net is at least `cents`: what the
 * vault must release for her contracted principal to arrive whole. netCents
 * never falls as the gross rises, so this is a search, not an inversion with
 * rounding to argue about.
 */
export function grossForCents(cents: number, fxMilli: number, p: RouteProvider): number | null {
  if (cents <= 0 || fxMilli <= 0) return null;
  let lo = 0;
  // Twice the cost-free gross is beyond any rate card whose costs are under half.
  let hi = Math.ceil((cents * 10_000_000 * 2) / fxMilli) + 1_000_000;
  if (netCents(hi, fxMilli, p) < cents) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (netCents(mid, fxMilli, p) >= cents) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Prices one rate card at one rate, and asks whether it can settle this ticket now. */
export function quote(request: QuoteRequest, grossMicroUsdc: number, now: string): RouteQuote {
  const p = request.provider;
  const gross = centsFromMicroUsdc(grossMicroUsdc, request.fx_rate_milli);
  const afterFx = Math.floor((gross * (10_000 - p.fx_spread_bps)) / 10_000);
  const fxCost = gross - afterFx;
  const fee = Math.ceil((afterFx * p.provider_fee_bps) / 10_000) + p.provider_fee_fixed_cents;
  const net = Math.max(0, afterFx - fee - p.network_fee_cents);
  const cost = gross - net;
  const expiresAt = isoFrom(request.quoted_at, p.quote_ttl_sec);
  const liquidityOk = p.liquidity_cents >= gross;

  const blocks: RouteReason[] = [];
  if (!p.enabled) blocks.push("ROUTE_PROVIDER_UNAVAILABLE");
  if (gross < p.min_ticket_cents || gross > p.max_ticket_cents) blocks.push("ROUTE_TICKET_OUTSIDE_POLICY");
  if (!liquidityOk) blocks.push("ROUTE_NO_LIQUIDITY");
  // A rate already struck cannot expire. A quote does: it is a price someone
  // will hold for a while, and FX execution risk is the risk of it running out
  // before the money moves. Where the reais were bought at allocation there is
  // nothing left to execute, however long ago that was.
  if (p.fx_struck === "payout" && seconds(now) >= seconds(expiresAt)) blocks.push("ROUTE_QUOTE_EXPIRED");

  return {
    route: p.route,
    provider: p.provider,
    asset: p.asset,
    gross_micro_usdc: grossMicroUsdc,
    fx_rate_milli: request.fx_rate_milli,
    fx_struck: p.fx_struck,
    fx_spread_bps: p.fx_spread_bps,
    gross_brl_cents: gross,
    fx_cost_cents: fxCost,
    provider_fee_cents: fee,
    network_fee_cents: p.network_fee_cents,
    net_brl_cents: net,
    total_cost_cents: cost,
    cost_bps: gross > 0 ? Math.round((cost * 10_000) / gross) : 0,
    execution_eta_sec: p.execution_eta_sec,
    quote_ttl_sec: p.quote_ttl_sec,
    quoted_at: request.quoted_at,
    expires_at: expiresAt,
    liquidity_ok: liquidityOk,
    reality: p.reality,
    hops: ROUTE_HOPS[p.route],
    feasible: blocks.length === 0,
    blocks,
  };
}

const byRoute = (quotes: RouteQuote[], route: SettlementRoute) => quotes.find((q) => q.route === route) ?? null;

/**
 * Chooses the settlement route for one disbursement: feasibility first, then
 * the reais delivered on the same gross, then what the costs were, then how
 * fast it settles, and a tie goes to the route with fewer conversions.
 */
export function compareRoutes(input: {
  /** The gross both routes are priced at, so their net reais compare. */
  gross_micro_usdc: number;
  /** Her contracted principal, which she receives whole; only reported against, never deducted. */
  principal_cents?: number | null;
  now: string;
  quotes: QuoteRequest[];
}): SettlementRouteResult {
  const gross = input.gross_micro_usdc;
  if (!Number.isSafeInteger(gross) || gross <= 0) throw new Error("gross_micro_usdc must be a positive integer");
  if (Number.isNaN(seconds(input.now))) throw new Error("now must be an ISO 8601 timestamp");

  const quotes = input.quotes
    .map((r) => quote(r, gross, input.now))
    .sort((a, b) => ROUTE_HOPS[a.route] - ROUTE_HOPS[b.route]);
  const feasible = quotes.filter((q) => q.feasible);
  const reasons = new Set<RouteReason>(quotes.flatMap((q) => q.blocks));

  let selected: SettlementRoute | null = null;
  let delta: number | null = null;

  if (feasible.length === 0) {
    reasons.add("NO_ROUTE_AVAILABLE");
  } else {
    // More reais to her first, then the cheaper. Then fewer conversions, before
    // speed: §7 of the addendum puts execution time before operational
    // complexity, but it also forbids routing through a stablecoin for its own
    // sake, and minutes of settlement do not buy a second counterparty to
    // reconcile. On equal economics the shorter route wins; speed breaks what
    // is left.
    const ranked = [...feasible].sort((a, b) =>
      b.net_brl_cents - a.net_brl_cents
      || a.total_cost_cents - b.total_cost_cents
      || a.hops - b.hops
      || a.execution_eta_sec - b.execution_eta_sec);
    const winner = ranked[0];
    const runnerUp = ranked[1] ?? null;
    selected = winner.route;
    if (runnerUp) delta = winner.net_brl_cents - runnerUp.net_brl_cents;

    const direct = byRoute(quotes, "direct_usdc_pix");
    const stable = byRoute(quotes, "brl_stable_pix");
    if (selected === "direct_usdc_pix") {
      // With no other route left, the other route's own block code says why.
      if (delta !== null && (delta > 0 || winner.total_cost_cents < runnerUp!.total_cost_cents)) reasons.add("DIRECT_LOWEST_COST");
      else if (delta !== null) reasons.add("DIRECT_FEWEST_STEPS");
      // The stablecoin route could have run, and its extra conversion took the difference.
      if (stable?.feasible && direct && stable.net_brl_cents < direct.net_brl_cents) reasons.add("EXTRA_CONVERSION_ADDS_COST");
    } else if (selected === "brl_stable_pix" && stable) {
      if (delta !== null && delta > 0) reasons.add("BRL_STABLE_BETTER_NET_BRL");
      // Structural, and true whether or not the other route ran: the rate was
      // struck before disbursement, so the payout leg carries no FX at all.
      if (stable.fx_struck === "allocation") {
        reasons.add("BRL_STABLE_NO_FX_ON_PAYOUT");
        if (direct && seconds(stable.quoted_at) < seconds(direct.quoted_at)) reasons.add("BRL_STABLE_LOCKS_PRINCIPAL_EARLIER");
      }
    }
  }

  const principal = input.principal_cents ?? null;
  const grossForPrincipal: Partial<Record<SettlementRoute, number | null>> = {};
  for (const r of input.quotes) {
    grossForPrincipal[r.provider.route] = principal === null ? null : grossForCents(principal, r.fx_rate_milli, r.provider);
  }

  return {
    model_version: SETTLEMENT_ROUTE_MODEL_VERSION,
    selected,
    reason_codes: REASON_ORDER.filter((r) => reasons.has(r)),
    quotes,
    compared_gross_micro_usdc: gross,
    net_brl_delta_cents: delta,
    principal_cents: principal,
    gross_for_principal: grossForPrincipal,
  };
}
