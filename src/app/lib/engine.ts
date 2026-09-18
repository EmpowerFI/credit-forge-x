import type { AllocationResult, PoolCheck, PoolId, PoolPolicy, RiskBand } from "@empowerfi/capital-allocation";
import { RULES as ELIGIBILITY_RULES } from "@empowerfi/eligibility-engine";
import { RULES as READINESS_RULES } from "@empowerfi/readiness-engine";
import { platform } from "./platform";

// The Credit Engine page. Two engines, one opportunity at a time:
//   Engine 1, credit: should this business become a qualified credit
//   opportunity? Readiness, then eligibility, as they were recorded and proven.
//   Engine 2, capital allocation: which available pool should fund it? The
//   engine re-run in the browser against today's liquidity.
// Nothing here writes: the database allocates when an opportunity opens to
// investors, so a run is an analysis and can never create an allocation.

export interface EngineProof {
  kind: string;
  status: string;
  signature: string | null;
  account: string | null;
  commitment: string | null;
  confirmed_at: string | null;
}

export interface EngineOpportunity {
  opportunity_id: string;
  code: string;
  queued: "0" | "1";
  created_at: string;
  status: string;
  purpose: string;
  business_sector: string | null;
  community: string | null;
  community_city: string | null;
  community_state: string | null;
  amount_cents: number;
  term_months: number;
  instalment_cents: number | null;
  risk_band: RiskBand;
  confidence: RiskBand | null;
  impact_eligible: boolean;
  funding_status: string | null;
  funding_pool: PoolId | null;
  allocation: AllocationResult | null;
  allocation_reason_codes: string[] | null;
  allocation_model_version: string | null;
  allocated_at: string | null;
  /** What a global allocation raised, and the rate it locked: the settlement comparator prices from these. */
  funding_target_micro_usdc: number | null;
  fx_brl_per_usdc_milli: number | null;
  readiness: {
    status: string;
    score: number;
    band: string;
    model_version: string;
    as_of_period: string;
    assessed_at: string;
    months_reported: number | null;
    consecutive_months: number | null;
    records_kept_bps: number | null;
    positive_months_last3: number | null;
    core_modules_completed: number | null;
    core_modules_total: number | null;
    community_verified: boolean | null;
  };
  eligibility: {
    decision: string;
    model_version: string;
    assessed_at: string;
    requested_cents: number | null;
    proposed_cents: number | null;
    affordability_bps: number | null;
    risk_band: RiskBand | null;
    confidence: RiskBand | null;
    reason_codes: string[] | null;
  };
  proofs: EngineProof[];
}

export const engineOpportunitiesKey = ["platform", "engine-opportunities"] as const;

export async function fetchEngineOpportunities(): Promise<EngineOpportunity[]> {
  const { data, error } = await platform.rpc("engine_opportunities");
  if (error) throw error;
  return (data ?? []) as unknown as EngineOpportunity[];
}

// ------------------------------------------------------------------ engine 1

export type CreditStepId = "business_data" | "preparation" | "readiness" | "affordability" | "risk" | "eligibility";

export interface CreditStep {
  id: CreditStepId;
  passed: boolean;
}

const QUALIFYING_DECISIONS = ["ELIGIBLE", "ELIGIBLE_REDUCED", "MANUAL_REVIEW"];

/**
 * Engine 1's checks, in order, read from the recorded readiness and eligibility
 * against the engines' own rules. A request held for review has not cleared
 * eligibility yet; one that was cleared and listed has.
 */
export function creditSteps(o: EngineOpportunity): CreditStep[] {
  const r = o.readiness;
  const e = o.eligibility;
  const held = o.status === "in_review";
  return [
    {
      id: "business_data",
      passed: (r.months_reported ?? 0) >= READINESS_RULES.MIN_MONTHS_REPORTED
        && (r.consecutive_months ?? 0) >= READINESS_RULES.MIN_CONSECUTIVE_MONTHS
        && (r.records_kept_bps === null || r.records_kept_bps >= READINESS_RULES.MIN_RECORDS_KEPT_BPS),
    },
    {
      id: "preparation",
      passed: r.community_verified !== false
        && (r.core_modules_total === null || (r.core_modules_completed ?? 0) >= r.core_modules_total),
    },
    { id: "readiness", passed: r.status === "CREDIT_READY" },
    {
      id: "affordability",
      passed: e.affordability_bps === null || e.affordability_bps <= ELIGIBILITY_RULES.MAX_INSTALMENT_OF_NET_BPS,
    },
    { id: "risk", passed: e.decision !== "NOT_ELIGIBLE" },
    { id: "eligibility", passed: !held && QUALIFYING_DECISIONS.includes(e.decision) },
  ];
}

/** Where Engine 1 stops: the first failed step, or null when it qualifies the request. */
export const creditStop = (steps: CreditStep[]) => steps.find((s) => !s.passed)?.id ?? null;

export const AFFORDABILITY_LIMIT_BPS = ELIGIBILITY_RULES.MAX_INSTALMENT_OF_NET_BPS;
export const READINESS_THRESHOLDS = READINESS_RULES;

// ------------------------------------------------------------------ engine 2

/** The order the page asks a pool's feasibility questions in: can it pay, may it, should it. */
export const CHECK_ORDER: PoolCheck["check"][] = ["liquidity", "ticket", "risk_appetite", "mandate"];

export const orderedChecks = (checks: PoolCheck[]) =>
  CHECK_ORDER.map((id) => checks.find((c) => c.check === id)).filter((c): c is PoolCheck => Boolean(c));

/** The economics of a pool for one opportunity, split the way the engine adds them up. */
export function economics(result: AllocationResult, pool: PoolId, policy: PoolPolicy) {
  const a = result[pool];
  return {
    required_return_bps: policy.required_return_bps,
    loss_and_serve_bps: a.all_in_bps - policy.required_return_bps - a.fx_hedge_bps - a.ramp_bps_year,
    fx_hedge_bps: a.fx_hedge_bps,
    ramp_bps_year: a.ramp_bps_year,
    all_in_bps: a.all_in_bps,
  };
}

// ---------------------------------------------------------------- the run

export type EngineState =
  | "IDLE"
  | "OPPORTUNITY_SELECTED"
  | "RUNNING_CREDIT_ENGINE"
  | "CREDIT_REJECTED"
  | "QUALIFIED_OPPORTUNITY"
  | "RUNNING_CAPITAL_ALLOCATION"
  | "DOMESTIC_SELECTED"
  | "GLOBAL_SELECTED"
  | "WAITING_FOR_CAPITAL"
  | "ERROR";

/**
 * The run as a timeline of ticks. Engine 1 takes one tick a step and stops at
 * a failed step. Engine 2 evaluates both pools side by side, one check a tick,
 * each branch stopping at its first failed check; then the economics of the
 * feasible pools; then the decision.
 */
export function runPlan(steps: CreditStep[], result: AllocationResult | null) {
  const stop = creditStop(steps);
  const creditTicks = stop ? steps.findIndex((s) => s.id === stop) + 1 : steps.length;
  if (stop || !result) return { creditTicks, poolTicks: 0, economicsTicks: 0, total: creditTicks + 1, rejected: Boolean(stop) };
  const branch = (pool: PoolId) => {
    const checks = orderedChecks(result[pool].checks);
    const failed = checks.findIndex((c) => !c.passed);
    return failed === -1 ? checks.length : failed + 1;
  };
  const poolTicks = Math.max(branch("domestic"), branch("global"));
  const feasible = [result.domestic.feasible, result.global.feasible].filter(Boolean).length;
  const economicsTicks = feasible > 0 ? 5 : 0;
  return { creditTicks, poolTicks, economicsTicks, total: creditTicks + 1 + poolTicks + economicsTicks + 1, rejected: false };
}

export function stateAt(tick: number, plan: ReturnType<typeof runPlan>, result: AllocationResult | null): EngineState {
  if (tick < plan.creditTicks) return "RUNNING_CREDIT_ENGINE";
  if (plan.rejected || !result) return "CREDIT_REJECTED";
  if (tick < plan.total) return tick < plan.creditTicks + 1 ? "RUNNING_CREDIT_ENGINE" : "RUNNING_CAPITAL_ALLOCATION";
  return result.pool === "domestic" ? "DOMESTIC_SELECTED" : result.pool === "global" ? "GLOBAL_SELECTED" : "WAITING_FOR_CAPITAL";
}

/** Milliseconds a tick: a whole run lands between four and seven seconds. */
export const TICK_MS = 340;
