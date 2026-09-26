// Capital Allocation Engine, v1 — "which pool of capital can fund this opportunity, sustainably?"
//
// Runs once an opportunity is qualified. There are two pools. Domestic P2P is
// Brazilian investors' capital in reais, reaching her business by Pix.
// Global P2P is international and impact investors' USDC on Solana, reaching
// her by a regulated off-ramp and Pix. She receives and repays in reais either
// way.
//
// Feasibility comes first, economics second:
//   1. Can the domestic pool take it? Risk appetite, ticket policy, mandate, liquidity.
//   2. Can the global pool take it? The same checks.
//   3. If both can, the one that costs her less a year wins; a tie goes domestic.
// A cheaper pool with no liquidity left is not a choice: global capital earns
// its place by the capacity, mandate or economics it adds to a specific pool,
// not by any claim about capital in Brazil as a whole.
//
// It is not a credit decision: eligibility already said the amount fits the
// business. It chooses where the capital comes from and what that costs.
//
// Deterministic, versioned, integers only (cents, basis points). The database
// runs the same rules (private.allocate_funding); vectors/scenarios.json holds
// them both to one answer, and the browser re-runs it.

export const CAPITAL_ALLOCATION_MODEL_VERSION = "capital-allocation-v1.0.0";

export type PoolId = "domestic" | "global";
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export type AllocationReason =
  | "DOMESTIC_LOWEST_COST"
  | "DOMESTIC_LIQUIDITY_AVAILABLE"
  | "DOMESTIC_POOL_EXHAUSTED"
  | "GLOBAL_EXPANDS_CAPACITY"
  | "GLOBAL_IMPACT_MANDATE_MATCH"
  | "GLOBAL_LOWER_REQUIRED_RETURN"
  | "GLOBAL_FX_COST_DOMINATES"
  | "GLOBAL_RAMP_COST_DOMINATES"
  | "GLOBAL_POOL_EXHAUSTED"
  | "RISK_BAND_NOT_ELIGIBLE"
  | "TICKET_OUTSIDE_POOL_POLICY"
  | "PURPOSE_OUTSIDE_POOL_MANDATE"
  | "NO_POOL_AVAILABLE";

/** A pool's policy and what it has left, in reais: global liquidity is converted at the quote before it gets here. */
export interface PoolPolicy {
  id: PoolId;
  available_cents: number;
  /** What its investors ask, a year. */
  required_return_bps: number;
  eligible_risk_bands: RiskBand[];
  min_ticket_cents: number;
  max_ticket_cents: number;
  /** Productive purposes it funds; empty funds any. */
  purposes: string[];
  /** Funds women-led businesses in verified communities as a mandate, not only as a return. */
  impact_mandate: boolean;
  /** Hedging reais against the pool's currency, a year. Zero for domestic. */
  fx_hedge_bps: number;
  /** Converting at the ramp, each way. Zero for domestic. */
  ramp_bps: number;
}

export interface AllocationOpportunity {
  amount_cents: number;
  term_months: number;
  risk_band: RiskBand;
  purpose: string;
  /** Women-led and in a verified community: every EmpowerFI opportunity is, by construction. */
  impact_eligible: boolean;
}

/** One feasibility check, with what was compared: the trace a person can read. */
export interface PoolCheck {
  check: "risk_appetite" | "ticket" | "mandate" | "liquidity";
  passed: boolean;
  /** The reason code it raises when it fails. */
  reason: AllocationReason;
  /** The opportunity's side: band, amount in cents, or purpose. */
  value: string | number;
  /** The pool's side: eligible bands, [min, max] cents, purposes (empty = any), available cents. */
  limit: string[] | [number, number] | number;
}

export interface PoolAssessment {
  pool: PoolId;
  feasible: boolean;
  /** Every feasibility check in the order the engine asks it; blocks are the failed ones. */
  checks: PoolCheck[];
  /** Why it cannot take this opportunity, empty when it can. */
  blocks: AllocationReason[];
  /** Her all-in cost a year through this pool: required return, expected loss, cost to serve, FX hedge and ramp. */
  all_in_bps: number;
  fx_hedge_bps: number;
  /** Both conversions spread over the term, a year. */
  ramp_bps_year: number;
}

export interface AllocationResult {
  model_version: string;
  pool: PoolId | null;
  reason_codes: AllocationReason[];
  domestic: PoolAssessment;
  global: PoolAssessment;
  /** Her side, through the chosen pool. */
  borrower_rate_bps_month: number | null;
  instalment_cents: number | null;
  /** The investors' side: what the chosen pool asks, and what is left after expected loss. */
  investor_return_bps: number | null;
  investor_net_return_bps: number | null;
}

export const RULES = {
  /** Expected loss a year by risk band, as in the capital portfolio. */
  EXPECTED_LOSS_BPS: { LOW: 300, MEDIUM: 700, HIGH: 1500 } as Record<RiskBand, number>,
  /** Origination and servicing, a year. */
  COST_TO_SERVE_BPS: 600,
} as const;

const REASON_ORDER: AllocationReason[] = [
  "DOMESTIC_LOWEST_COST",
  "DOMESTIC_LIQUIDITY_AVAILABLE",
  "GLOBAL_LOWER_REQUIRED_RETURN",
  "GLOBAL_EXPANDS_CAPACITY",
  "GLOBAL_IMPACT_MANDATE_MATCH",
  "GLOBAL_FX_COST_DOMINATES",
  "GLOBAL_RAMP_COST_DOMINATES",
  "DOMESTIC_POOL_EXHAUSTED",
  "GLOBAL_POOL_EXHAUSTED",
  "RISK_BAND_NOT_ELIGIBLE",
  "TICKET_OUTSIDE_POOL_POLICY",
  "PURPOSE_OUTSIDE_POOL_MANDATE",
  "NO_POOL_AVAILABLE",
];

/** Micro-USDC in reais at a quote (milli-reais per USDC), rounded down to the centavo. */
export function usdcToCents(microUsdc: number, fxMilli: number): number {
  return Math.floor((microUsdc * fxMilli) / 10_000_000);
}

/** The feasibility checks one pool puts to one opportunity, passed or not. */
export function poolChecks(pool: PoolPolicy, o: AllocationOpportunity): PoolCheck[] {
  return [
    { check: "risk_appetite", passed: pool.eligible_risk_bands.includes(o.risk_band), reason: "RISK_BAND_NOT_ELIGIBLE",
      value: o.risk_band, limit: [...pool.eligible_risk_bands] },
    { check: "ticket", passed: o.amount_cents >= pool.min_ticket_cents && o.amount_cents <= pool.max_ticket_cents, reason: "TICKET_OUTSIDE_POOL_POLICY",
      value: o.amount_cents, limit: [pool.min_ticket_cents, pool.max_ticket_cents] },
    { check: "mandate", passed: pool.purposes.length === 0 || pool.purposes.includes(o.purpose), reason: "PURPOSE_OUTSIDE_POOL_MANDATE",
      value: o.purpose, limit: [...pool.purposes] },
    { check: "liquidity", passed: pool.available_cents >= o.amount_cents, reason: pool.id === "domestic" ? "DOMESTIC_POOL_EXHAUSTED" : "GLOBAL_POOL_EXHAUSTED",
      value: o.amount_cents, limit: pool.available_cents },
  ];
}

function assess(pool: PoolPolicy, o: AllocationOpportunity): PoolAssessment {
  const checks = poolChecks(pool, o);
  const blocks = checks.filter((c) => !c.passed).map((c) => c.reason);
  // Into reais and back out, spread over the loan's years.
  const rampYear = Math.ceil((2 * pool.ramp_bps * 12) / o.term_months);
  return {
    pool: pool.id,
    feasible: blocks.length === 0,
    checks,
    blocks,
    all_in_bps: pool.required_return_bps + RULES.EXPECTED_LOSS_BPS[o.risk_band] + RULES.COST_TO_SERVE_BPS + pool.fx_hedge_bps + rampYear,
    fx_hedge_bps: pool.fx_hedge_bps,
    ramp_bps_year: rampYear,
  };
}

/** Chooses the pool for one opportunity, given what each pool has left. */
export function allocate(o: AllocationOpportunity, domesticPool: PoolPolicy, globalPool: PoolPolicy): AllocationResult {
  if (!Number.isSafeInteger(o.amount_cents) || o.amount_cents <= 0) throw new Error("amount_cents must be a positive integer");
  if (!Number.isSafeInteger(o.term_months) || o.term_months <= 0) throw new Error("term_months must be a positive integer");
  const d = assess(domesticPool, o);
  const g = assess(globalPool, o);
  const reasons = new Set<AllocationReason>([...d.blocks, ...g.blocks]);

  let pool: PoolId | null = null;
  if (d.feasible && g.feasible) {
    pool = g.all_in_bps < d.all_in_bps ? "global" : "domestic";
    if (pool === "domestic") {
      reasons.add("DOMESTIC_LOWEST_COST");
      reasons.add("DOMESTIC_LIQUIDITY_AVAILABLE");
      // Global capital asked less, and its conversion costs took the difference away.
      if (globalPool.required_return_bps < domesticPool.required_return_bps) {
        reasons.add(g.fx_hedge_bps >= g.ramp_bps_year ? "GLOBAL_FX_COST_DOMINATES" : "GLOBAL_RAMP_COST_DOMINATES");
      }
    } else {
      reasons.add("GLOBAL_LOWER_REQUIRED_RETURN");
    }
  } else if (d.feasible) {
    pool = "domestic";
    reasons.add("DOMESTIC_LIQUIDITY_AVAILABLE");
  } else if (g.feasible) {
    pool = "global";
    reasons.add("GLOBAL_EXPANDS_CAPACITY");
  } else {
    reasons.add("NO_POOL_AVAILABLE");
  }
  if (pool === "global" && globalPool.impact_mandate && o.impact_eligible) reasons.add("GLOBAL_IMPACT_MANDATE_MATCH");

  const chosen = pool === "domestic" ? d : pool === "global" ? g : null;
  const chosenPolicy = pool === "domestic" ? domesticPool : pool === "global" ? globalPool : null;
  const monthly = chosen ? Math.ceil(chosen.all_in_bps / 12) : null;
  return {
    model_version: CAPITAL_ALLOCATION_MODEL_VERSION,
    pool,
    reason_codes: REASON_ORDER.filter((r) => reasons.has(r)),
    domestic: d,
    global: g,
    borrower_rate_bps_month: monthly,
    // Flat, as eligibility sizes instalments, rounded up to the centavo.
    instalment_cents: monthly === null ? null : Math.ceil((o.amount_cents * (10_000 + monthly * o.term_months)) / (10_000 * o.term_months)),
    investor_return_bps: chosenPolicy ? chosenPolicy.required_return_bps : null,
    investor_net_return_bps: chosenPolicy ? chosenPolicy.required_return_bps - RULES.EXPECTED_LOSS_BPS[o.risk_band] : null,
  };
}

export interface PortfolioAllocation {
  results: AllocationResult[];
  demand_cents: number;
  /** Demand the domestic pool could fund on its own, taking opportunities in order. */
  domestic_only_cents: number;
  /** Demand funded by both pools together. */
  combined_cents: number;
  domestic_coverage_bps: number;
  combined_coverage_bps: number;
  domestic_left_cents: number;
  global_left_cents: number;
}

/** Allocates opportunities in order, each drawing down the pool it gets; and what the domestic pool alone would have covered. */
export function allocatePortfolio(opportunities: AllocationOpportunity[], domesticPool: PoolPolicy, globalPool: PoolPolicy): PortfolioAllocation {
  const run = (withGlobal: boolean) => {
    let dLeft = domesticPool.available_cents;
    let gLeft = withGlobal ? globalPool.available_cents : 0;
    let funded = 0;
    const results = opportunities.map((o) => {
      const r = allocate(o, { ...domesticPool, available_cents: dLeft }, { ...globalPool, available_cents: gLeft });
      if (r.pool === "domestic") dLeft -= o.amount_cents;
      if (r.pool === "global") gLeft -= o.amount_cents;
      if (r.pool) funded += o.amount_cents;
      return r;
    });
    return { results, funded, dLeft, gLeft };
  };
  const demand = opportunities.reduce((n, o) => n + o.amount_cents, 0);
  const alone = run(false);
  const both = run(true);
  const bps = (part: number) => (demand > 0 ? Math.floor((part * 10_000) / demand) : 0);
  return {
    results: both.results,
    demand_cents: demand,
    domestic_only_cents: alone.funded,
    combined_cents: both.funded,
    domestic_coverage_bps: bps(alone.funded),
    combined_coverage_bps: bps(both.funded),
    domestic_left_cents: both.dLeft,
    global_left_cents: both.gLeft,
  };
}

// v2 — the Capital Network. allocate() above still decides the two P2P pools
// and nothing about it changed; matchCapital() asks the wider question of
// which instrument, or which combination of them, fits a need at all.
export * from "./network";
