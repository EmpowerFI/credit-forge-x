// Global Capital Eligibility — "domestic capacity left a gap. Should
// international money be the answer to it?" (addendum v2 §5, §17).
//
// The network engine in ./network.ts already offers the residual to a global
// route and puts the same seven gates to it. What it never did was record the
// answer as an answer *about global capital*: a gap nothing took came out as
// unfunded demand, and nobody could read why money from abroad was not it.
//
// This module asks that question once, after the domestic pass, and records it.
// It is not a second engine: it reuses network.ts's Gate shape, its reason
// vocabulary and its ordering, so the audit console keeps one vocabulary for
// one question (PLAN_CAPITAL_NETWORK_V2 §3.1).
//
// Four questions are genuinely new here:
//
//   economics             her all-in cost once what it really costs to move the
//                         money replaces the constant the pool rate carries
//   evidence              cross-border capital asks for more reported history
//                         than a local product does, and says how much
//   regulatory_route      a regulated rail must be able to settle this gap now
//   domestic_reconsidered demand a local route would take once she brings a
//                         paper does not go abroad
//
// The last one is §17's own criterion, and it points the way it points on
// purpose: a residual gap can be refused for global funding *even when domestic
// coverage is insufficient*, because sending it abroad would be the wrong
// answer, not the only one.
//
// No FX and no spread is computed here. The mobilisation cost arrives already
// quoted by packages/settlement-route, which is the one place in this project
// allowed to price a conversion.
//
// Deterministic, integers only (centavos, basis points).

import { COST_CEILING_BPS, instalmentCents, type CapitalPlan, type Instrument, type NetworkReason } from "./network";

export const GLOBAL_CAPITAL_MODEL_VERSION = "global-capital-v1.0.0";

/**
 * The share of the readiness data_quality component (0–25) a cross-border
 * route asks for. Higher than a local product asks, and stated as policy rather
 * than buried: money that crosses a border is reported on to people who will
 * never meet her, and the evidence behind it has to carry that.
 */
export const GLOBAL_EVIDENCE_MIN_SCORE = 12;

/** Months of reported history behind that score. One good month is not a history. */
export const GLOBAL_MIN_MONTHS_REPORTED = 3;

/**
 * A domestic refusal she could undo this week. Papers she can fetch; a state
 * the product does not serve, a purpose outside a mandate, a business younger
 * than a floor, an exhausted partner — those she cannot.
 */
export const RECOVERABLE_DOMESTIC_BLOCKS: NetworkReason[] = ["INSUFFICIENT_DOCUMENTATION"];

/** What the global question is asked against. Every figure comes from something else that computed it. */
export interface GlobalGapContext {
  /** The residual the domestic pass could not absorb: external_capital_gap_cents. */
  gap_cents: number;
  term_months: number;
  /** Her affordable instalment, as the eligibility assessment sized it. */
  max_instalment_cents: number;
  /** What the domestic allocations of this same plan already take of that instalment. */
  instalment_committed_cents: number;
  /** The global route's all-in annual cost, as the pool engine priced it. */
  route_cost_bps: number;
  /**
   * What that rate already carries for moving money: the pool engine's
   * ceil(2 * ramp_bps * 12 / term). Replaced, not added to — the estimate is
   * already in her rate, and counting it twice would be the easy mistake.
   */
  modelled_ramp_annual_bps: number;
  /** One conversion, quoted by the settlement comparator over this gap. */
  quoted_mobilization_bps: number;
  /**
   * The return leg, still modelled: nothing in this product prices BRL → USDC,
   * and inventing a quote for it would be a third place that prices a spread.
   */
  modelled_return_ramp_bps: number;
  /** The readiness data_quality component, 0–25, and the history behind it. */
  evidence_score: number;
  months_reported: number;
  /** Whether a regulated rail can settle this gap now, from the comparator. */
  settlement_feasible: boolean;
  /** How real that rail is, carried through so no screen overstates it. */
  settlement_reality: string;
  /** Domestic instruments refused only for something she could fix. */
  recoverable_domestic: string[];
}

/** One gate of the global question, with both sides of the comparison. */
export interface GlobalGate {
  gate: "gap" | "economics" | "affordability" | "evidence" | "regulatory_route" | "domestic_reconsidered";
  passed: boolean;
  reason: NetworkReason;
  value: string | number;
  limit: string | number | string[];
}

/** Her cost through the global route once the estimate is replaced by a quote. */
export interface GlobalEconomics {
  /** The pool engine's annual all-in, as her rate carries it today. */
  route_cost_bps: number;
  /** The part of that which is a modelled cost of moving money. */
  modelled_ramp_annual_bps: number;
  /** One conversion, quoted. */
  quoted_mobilization_bps: number;
  /** The return leg, modelled. */
  modelled_return_ramp_bps: number;
  /** Both legs together, one time, over the principal. */
  mobilization_total_bps: number;
  /** Those legs spread over the term, to compare with an annual rate. */
  mobilization_annual_bps: number;
  /** Her annual all-in with the quote in place of the constant. */
  total_cost_bps: number;
  /** What the constant was hiding, positive when the quote costs her more. */
  delta_bps: number;
  /** Her monthly instalment on the gap, at that total cost. */
  instalment_cents: number;
  /** What the domestic allocations left of her instalment. */
  instalment_headroom_cents: number;
}

export interface GlobalEligibility {
  model_version: string;
  /** "not_needed" is not a refusal: domestic capacity covered her. */
  decision: "eligible" | "refused" | "not_needed";
  gates: GlobalGate[];
  reason_codes: NetworkReason[];
  gap_cents: number;
  /** The addendum's Eligible External Capital Gap: the gap global capital may actually take. */
  eligible_gap_cents: number;
  economics: GlobalEconomics;
}

/** Her economics on the gap, with the quote in place of the modelled constant. */
export function globalEconomics(ctx: GlobalGapContext): GlobalEconomics {
  const mobilizationTotal = ctx.quoted_mobilization_bps + ctx.modelled_return_ramp_bps;
  const mobilizationAnnual = Math.ceil((mobilizationTotal * 12) / ctx.term_months);
  const total = ctx.route_cost_bps - ctx.modelled_ramp_annual_bps + mobilizationAnnual;
  return {
    route_cost_bps: ctx.route_cost_bps,
    modelled_ramp_annual_bps: ctx.modelled_ramp_annual_bps,
    quoted_mobilization_bps: ctx.quoted_mobilization_bps,
    modelled_return_ramp_bps: ctx.modelled_return_ramp_bps,
    mobilization_total_bps: mobilizationTotal,
    mobilization_annual_bps: mobilizationAnnual,
    total_cost_bps: total,
    delta_bps: total - ctx.route_cost_bps,
    instalment_cents: ctx.gap_cents > 0 ? instalmentCents(ctx.gap_cents, total, ctx.term_months) : 0,
    instalment_headroom_cents: Math.max(0, ctx.max_instalment_cents - ctx.instalment_committed_cents),
  };
}

/** The gates the global question puts to a residual gap, in the order it asks them. */
export function globalGates(ctx: GlobalGapContext, e: GlobalEconomics): GlobalGate[] {
  const recoverable = ctx.recoverable_domestic;
  return [
    { gate: "gap", passed: ctx.gap_cents > 0,
      reason: "GLOBAL_GAP_ABSENT", value: ctx.gap_cents, limit: 0 },
    // Local demand a local route would take once she brings a paper. Asked
    // before the economics, because the cheapest global route is still the
    // wrong answer to it.
    { gate: "domestic_reconsidered", passed: recoverable.length === 0,
      reason: "GLOBAL_DOMESTIC_ROUTE_RECOVERABLE", value: recoverable.join(","), limit: [...RECOVERABLE_DOMESTIC_BLOCKS] },
    { gate: "economics", passed: e.total_cost_bps <= COST_CEILING_BPS,
      reason: "GLOBAL_COST_EXCEEDS_CEILING", value: e.total_cost_bps, limit: COST_CEILING_BPS },
    // The affordability gate of network.ts, asked a second time: against the
    // quoted cost, and against what the domestic routes left of her instalment
    // rather than against the whole of it.
    { gate: "affordability", passed: e.instalment_cents <= e.instalment_headroom_cents,
      reason: "GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION", value: e.instalment_cents, limit: e.instalment_headroom_cents },
    { gate: "evidence",
      passed: ctx.evidence_score >= GLOBAL_EVIDENCE_MIN_SCORE && ctx.months_reported >= GLOBAL_MIN_MONTHS_REPORTED,
      reason: "GLOBAL_EVIDENCE_INSUFFICIENT",
      value: `${ctx.evidence_score}/25 over ${ctx.months_reported}`,
      limit: `${GLOBAL_EVIDENCE_MIN_SCORE}/25 over ${GLOBAL_MIN_MONTHS_REPORTED}` },
    { gate: "regulatory_route", passed: ctx.settlement_feasible,
      reason: "GLOBAL_NO_REGULATED_ROUTE", value: ctx.settlement_reality, limit: ctx.gap_cents },
  ];
}

const REASON_ORDER: NetworkReason[] = [
  "GLOBAL_GAP_CONFIRMED",
  "GLOBAL_ECONOMICS_WITHIN_CEILING",
  "GLOBAL_EVIDENCE_SUFFICIENT",
  "GLOBAL_ROUTE_REGULATED",
  "GLOBAL_GAP_ABSENT",
  "GLOBAL_DOMESTIC_ROUTE_RECOVERABLE",
  "GLOBAL_COST_EXCEEDS_CEILING",
  "GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION",
  "GLOBAL_EVIDENCE_INSUFFICIENT",
  "GLOBAL_NO_REGULATED_ROUTE",
];

/**
 * Asks whether international capital may take this residual gap, and says why
 * either way. Nothing here allocates: a gap this call finds eligible is still
 * only a gap a global instrument may then be offered.
 */
export function globalEligibility(ctx: GlobalGapContext): GlobalEligibility {
  if (!Number.isSafeInteger(ctx.gap_cents) || ctx.gap_cents < 0) throw new Error("gap_cents must be a non-negative integer");
  if (!Number.isSafeInteger(ctx.term_months) || ctx.term_months <= 0) throw new Error("term_months must be a positive integer");

  const economics = globalEconomics(ctx);
  const asked = globalGates(ctx, economics);

  // A gap that never existed is not a refusal, and nothing downstream of it was
  // ever asked: no quote was requested, no evidence was weighed. The trace says
  // so by carrying one gate, not six answers to questions nobody put.
  const absent = asked[0].passed === false;
  const gates = absent ? [asked[0]] : asked;
  const reasons = new Set<NetworkReason>(gates.filter((g) => !g.passed).map((g) => g.reason));
  const decision = absent ? "not_needed" : reasons.size === 0 ? "eligible" : "refused";

  if (!absent) {
    reasons.add("GLOBAL_GAP_CONFIRMED");
    const passed = (g: GlobalGate["gate"]) => gates.find((x) => x.gate === g)?.passed === true;
    if (passed("economics") && passed("affordability")) reasons.add("GLOBAL_ECONOMICS_WITHIN_CEILING");
    if (passed("evidence")) reasons.add("GLOBAL_EVIDENCE_SUFFICIENT");
    if (passed("regulatory_route")) reasons.add("GLOBAL_ROUTE_REGULATED");
  }

  return {
    model_version: GLOBAL_CAPITAL_MODEL_VERSION,
    decision,
    gates,
    reason_codes: REASON_ORDER.filter((r) => reasons.has(r)),
    gap_cents: ctx.gap_cents,
    eligible_gap_cents: decision === "eligible" ? ctx.gap_cents : 0,
    economics,
  };
}

// ------------------------------------------------- reading the domestic pass

/**
 * Domestic instruments this need was refused by for something she could fix,
 * and nothing else. A route also blocked on its region or its ticket is not
 * recoverable by fetching a paper, so it does not count.
 */
export function recoverableDomestic(plan: CapitalPlan, instruments: Instrument[]): string[] {
  const domestic = new Set(instruments.filter((i) => i.is_domestic).map((i) => i.id));
  return plan.evaluated
    .filter((a) => domestic.has(a.instrument_id) && !a.eligible
      && a.blocks.every((b) => RECOVERABLE_DOMESTIC_BLOCKS.includes(b)))
    .map((a) => a.instrument_id);
}

/**
 * What the plan's domestic allocations already take of her monthly instalment.
 * v1 capped each route at its own max_instalment_share_bps and never summed
 * them, so a stack of two credit routes could in principle commit more of her
 * month than eligibility allowed. The global question is where that sum first
 * has to be honest, because it is the last route offered.
 */
export function instalmentCommittedCents(plan: CapitalPlan, instruments: Instrument[], termMonths: number): number {
  const byId = new Map(instruments.map((i) => [i.id, i]));
  let total = 0;
  for (const a of plan.allocations) {
    const i = byId.get(a.instrument_id);
    // A route with no repayment takes nothing from her month, and the global
    // route is the one being asked about — counting its own instalment against
    // its own headroom would refuse every gap it was offered.
    if (!i || !i.is_domestic || !i.is_credit || i.max_instalment_share_bps === null) continue;
    total += instalmentCents(a.amount_cents, i.estimated_cost_bps ?? 0, termMonths);
  }
  return total;
}
