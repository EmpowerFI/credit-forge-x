// The Capital Network — "which instrument, or which combination, fits this
// need?" (MVP addendum §2, §6, §7).
//
// v1 of this engine asked one question: domestic pool or global pool? Both
// answers were a loan funded by investors. A business that needs R$5,000 for
// stock and services may be better served by a regional partner product for
// part of it, a microcredit line for another part, and a productive exchange
// inside a network for the rest. This module answers that question. allocate()
// in ./index.ts is untouched and still decides the two P2P pools.
//
// Two rules the code is built around:
//
//   Domestic first, global for the residual. The global route is not a
//   competitor to local products; it exists for the demand local capacity
//   cannot absorb. So domestic instruments are allocated first, what they
//   leave is the external capital gap, and only then is a global route offered
//   against that gap. That is also what makes the gap legible: it is a
//   measurement of the domestic network, taken before global money hides it.
//
//   A match is never an approval. Every instrument whose owner still has to say
//   yes carries requires_partner_approval, and the reason codes say so. Nothing
//   here creates a loan, an investment or a position.
//
// Deterministic, integers only (centavos, basis points, hundredths of a point).

export const CAPITAL_NETWORK_MODEL_VERSION = "capital-network-v1.0.0";

export type InstrumentType =
  | "regional_credit_product"
  | "microcredit"
  | "commercial_credit"
  | "productive_exchange_network"
  | "sponsored_capital"
  | "domestic_p2p"
  | "global_impact_capital";

/**
 * One vocabulary, not two. Where the addendum's §8 collides with a code the
 * pool engine already raises, the existing spelling wins, so the audit console
 * never shows two answers to one question.
 */
export type NetworkReason =
  // why a route was chosen
  | "PURPOSE_MATCH"
  | "TICKET_MATCH"
  | "REGION_MATCH"
  | "PARTNER_CAPACITY_AVAILABLE"
  | "LOWER_ESTIMATED_COST"
  | "CLOSED_NETWORK_PURPOSE_MATCH"
  | "SPONSORED_PROGRAM_MATCH"
  | "GLOBAL_IMPACT_MANDATE_MATCH"
  | "GLOBAL_EXPANDS_CAPACITY"
  // what the network could and could not do
  | "DOMESTIC_COVERAGE_SUFFICIENT"
  | "DOMESTIC_CAPACITY_PARTIAL"
  | "DOMESTIC_POOL_EXHAUSTED"
  // why a route was refused
  | "AFFORDABILITY_LIMIT"
  | "TICKET_OUTSIDE_POOL_POLICY"
  | "PURPOSE_OUTSIDE_POOL_MANDATE"
  | "REGION_NOT_ELIGIBLE"
  | "BUSINESS_TOO_YOUNG"
  | "INSUFFICIENT_DOCUMENTATION"
  | "PARTNER_CAPACITY_EXHAUSTED"
  | "MANUAL_REVIEW_REQUIRED"
  | "NO_ROUTE_AVAILABLE"
  // the second question, asked of the residual gap by ./global.ts. One
  // vocabulary for one audit console, so these live here with the rest.
  | "GLOBAL_GAP_CONFIRMED"
  | "GLOBAL_ECONOMICS_WITHIN_CEILING"
  | "GLOBAL_EVIDENCE_SUFFICIENT"
  | "GLOBAL_ROUTE_REGULATED"
  | "GLOBAL_GAP_ABSENT"
  | "GLOBAL_DOMESTIC_ROUTE_RECOVERABLE"
  | "GLOBAL_COST_EXCEEDS_CEILING"
  | "GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION"
  | "GLOBAL_EVIDENCE_INSUFFICIENT"
  | "GLOBAL_NO_REGULATED_ROUTE";

/** A product a provider offers, with the policy it is offered under. */
export interface Instrument {
  /** The instrument's stable code. */
  id: string;
  provider: string;
  name: string;
  type: InstrumentType;
  /** False for a route that must never be described as a loan or as credit. */
  is_credit: boolean;
  /** Whether its owner still has to say yes. */
  requires_partner_approval: boolean;
  ticket_min_cents: number;
  ticket_max_cents: number;
  /** Empty means no stated restriction, which is not the same as everywhere. */
  eligible_uf: string[];
  /** Empty funds any productive purpose. */
  purposes: string[];
  business_age_min_months: number;
  required_documents: string[];
  /** The share of her affordable instalment this route may take; null where it has no repayment. */
  max_instalment_share_bps: number | null;
  /** Her all-in annual cost through this route, where its owner states one. */
  estimated_cost_bps: number | null;
  capacity_cents: number;
  impact_mandate: boolean;
  is_domestic: boolean;
}

/** What she needs, and what the engines already established about her. */
export interface CapitalNeed {
  amount_cents: number;
  term_months: number;
  purpose: string;
  uf: string;
  business_age_months: number;
  /** What she has on file, against each instrument's required_documents. */
  documents: string[];
  /** Her affordable instalment, from the eligibility assessment. */
  max_instalment_cents: number;
  /** Women-led and in a verified community. */
  impact_eligible: boolean;
  /** Gate 1: the opportunity exists, so eligibility passed. False only in a what-if. */
  readiness_ok: boolean;
  /** Whether a manual review may proceed where readiness did not pass. */
  manual_review_allowed: boolean;
}

/** One gate, with both sides of the comparison: the trace a person can read. */
export interface Gate {
  gate: "geography" | "ticket" | "purpose" | "business_age" | "documents" | "affordability" | "capacity";
  passed: boolean;
  reason: NetworkReason;
  value: string | number;
  limit: string[] | [number, number] | number;
}

/** A fit score's terms, each 0–100, so a ranking can be explained in one sentence. */
export interface FitBreakdown {
  purpose: number;
  amount_coverage: number;
  cost: number;
  availability: number;
  geography: number;
  mandate: number;
  operational: number;
}

export interface InstrumentAssessment {
  instrument_id: string;
  eligible: boolean;
  gates: Gate[];
  blocks: NetworkReason[];
  /** The most this route could take, after affordability and capacity. */
  max_takeable_cents: number;
  /** 0–10000, weights applied. Hard gates override it. */
  fit_score: number;
  fit: FitBreakdown;
}

export interface Allocation {
  instrument_id: string;
  amount_cents: number;
  fit_score: number;
  reasons: NetworkReason[];
  requires_partner_approval: boolean;
  is_credit: boolean;
}

export interface CapitalPlan {
  model_version: string;
  evaluated: InstrumentAssessment[];
  allocations: Allocation[];
  reason_codes: NetworkReason[];
  requested_cents: number;
  /** What domestic instruments took. */
  domestic_coverage_cents: number;
  /** What a global route took of the residual domestic could not absorb. */
  global_coverage_cents: number;
  /** Qualified demand nothing in the network could take. */
  unfunded_cents: number;
  /** What domestic capacity could not absorb: the addendum's External Capital Gap. */
  external_capital_gap_cents: number;
  status: "recommended" | "manual_review" | "no_route";
}

/**
 * The weights of §6, in basis points, summing to 10000. Configurable policy
 * about *fit*, and not credit policy: the hard gates above decide who is
 * eligible at all, and no weight can overturn one.
 */
export const FIT_WEIGHTS = {
  purpose: 2500,
  amount_coverage: 2000,
  cost: 2000,
  availability: 1500,
  geography: 1000,
  mandate: 500,
  operational: 500,
} as const;

/**
 * The annual all-in cost at which a route scores zero on cost. Above it the
 * term is floored rather than going negative — a very expensive route is still
 * a route, and the gates, not the score, are what refuse one.
 */
export const COST_CEILING_BPS = 12_000;

const REASON_ORDER: NetworkReason[] = [
  "DOMESTIC_COVERAGE_SUFFICIENT",
  "DOMESTIC_CAPACITY_PARTIAL",
  "DOMESTIC_POOL_EXHAUSTED",
  "PURPOSE_MATCH",
  "CLOSED_NETWORK_PURPOSE_MATCH",
  "SPONSORED_PROGRAM_MATCH",
  "TICKET_MATCH",
  "REGION_MATCH",
  "PARTNER_CAPACITY_AVAILABLE",
  "LOWER_ESTIMATED_COST",
  "GLOBAL_EXPANDS_CAPACITY",
  "GLOBAL_IMPACT_MANDATE_MATCH",
  "AFFORDABILITY_LIMIT",
  "TICKET_OUTSIDE_POOL_POLICY",
  "PURPOSE_OUTSIDE_POOL_MANDATE",
  "REGION_NOT_ELIGIBLE",
  "BUSINESS_TOO_YOUNG",
  "INSUFFICIENT_DOCUMENTATION",
  "PARTNER_CAPACITY_EXHAUSTED",
  "MANUAL_REVIEW_REQUIRED",
  "NO_ROUTE_AVAILABLE",
];

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * The largest principal whose flat instalment still fits the share of her
 * affordable instalment this route is allowed to take. The instalment formula
 * is the pool engine's, so a route priced like a pool sizes like one.
 */
export function affordableAmountCents(need: CapitalNeed, i: Instrument): number {
  if (i.max_instalment_share_bps === null) return Number.MAX_SAFE_INTEGER;
  const allowance = Math.floor((need.max_instalment_cents * i.max_instalment_share_bps) / 10_000);
  if (allowance <= 0) return 0;
  const monthly = Math.ceil((i.estimated_cost_bps ?? 0) / 12);
  return Math.floor((allowance * 10_000 * need.term_months) / (10_000 + monthly * need.term_months));
}

/** The gates one instrument puts to one need, in the order the engine asks them. */
export function gates(need: CapitalNeed, i: Instrument): Gate[] {
  const missing = i.required_documents.filter((d) => !need.documents.includes(d));
  const affordable = affordableAmountCents(need, i);
  return [
    { gate: "geography", passed: i.eligible_uf.length === 0 || i.eligible_uf.includes(need.uf),
      reason: "REGION_NOT_ELIGIBLE", value: need.uf, limit: [...i.eligible_uf] },
    // The ticket floor is a real refusal; the ceiling only caps what it takes.
    { gate: "ticket", passed: Math.min(need.amount_cents, i.ticket_max_cents) >= i.ticket_min_cents,
      reason: "TICKET_OUTSIDE_POOL_POLICY", value: need.amount_cents, limit: [i.ticket_min_cents, i.ticket_max_cents] },
    { gate: "purpose", passed: i.purposes.length === 0 || i.purposes.includes(need.purpose),
      reason: "PURPOSE_OUTSIDE_POOL_MANDATE", value: need.purpose, limit: [...i.purposes] },
    { gate: "business_age", passed: need.business_age_months >= i.business_age_min_months,
      reason: "BUSINESS_TOO_YOUNG", value: need.business_age_months, limit: i.business_age_min_months },
    { gate: "documents", passed: missing.length === 0,
      reason: "INSUFFICIENT_DOCUMENTATION", value: missing.join(","), limit: [...i.required_documents] },
    { gate: "affordability", passed: affordable >= i.ticket_min_cents,
      reason: "AFFORDABILITY_LIMIT", value: need.max_instalment_cents, limit: affordable },
    { gate: "capacity", passed: i.capacity_cents >= i.ticket_min_cents,
      reason: "PARTNER_CAPACITY_EXHAUSTED", value: i.ticket_min_cents, limit: i.capacity_cents },
  ];
}

/** How well an eligible instrument fits, term by term. */
export function fitOf(need: CapitalNeed, i: Instrument, takeable: number): FitBreakdown {
  const cost = i.estimated_cost_bps;
  return {
    // Naming the purpose beats funding anything.
    purpose: i.purposes.includes(need.purpose) ? 100 : 60,
    amount_coverage: clamp(Math.floor((takeable * 100) / need.amount_cents)),
    // A route with no cost of capital — an exchange, a grant — scores full.
    cost: cost === null ? 100 : clamp(100 - Math.floor((cost * 100) / COST_CEILING_BPS)),
    availability: clamp(Math.floor((Math.min(i.capacity_cents, need.amount_cents) * 100) / need.amount_cents)),
    geography: i.eligible_uf.includes(need.uf) ? 100 : 70,
    mandate: i.impact_mandate && need.impact_eligible ? 100 : 50,
    // Friction she would meet: another approval, and papers to find.
    operational: clamp(100 - (i.requires_partner_approval ? 20 : 0) - i.required_documents.length * 10),
  };
}

export function fitScore(f: FitBreakdown): number {
  return (
    f.purpose * FIT_WEIGHTS.purpose +
    f.amount_coverage * FIT_WEIGHTS.amount_coverage +
    f.cost * FIT_WEIGHTS.cost +
    f.availability * FIT_WEIGHTS.availability +
    f.geography * FIT_WEIGHTS.geography +
    f.mandate * FIT_WEIGHTS.mandate +
    f.operational * FIT_WEIGHTS.operational
  ) / 100 | 0;
}

function assess(need: CapitalNeed, i: Instrument): InstrumentAssessment {
  const g = gates(need, i);
  const blocks = g.filter((c) => !c.passed).map((c) => c.reason);
  const takeable = Math.max(0, Math.min(need.amount_cents, i.ticket_max_cents, affordableAmountCents(need, i), i.capacity_cents));
  const fit = fitOf(need, i, takeable);
  return {
    instrument_id: i.id,
    eligible: blocks.length === 0,
    gates: g,
    blocks,
    max_takeable_cents: blocks.length === 0 ? takeable : 0,
    fit_score: blocks.length === 0 ? fitScore(fit) : 0,
    fit,
  };
}

/** Why this instrument earned its place in the stack. */
function reasonsFor(need: CapitalNeed, i: Instrument, cheapest: boolean): NetworkReason[] {
  const out: NetworkReason[] = [];
  if (i.purposes.includes(need.purpose)) {
    out.push(i.type === "productive_exchange_network" ? "CLOSED_NETWORK_PURPOSE_MATCH" : "PURPOSE_MATCH");
  }
  if (i.type === "sponsored_capital") out.push("SPONSORED_PROGRAM_MATCH");
  if (i.eligible_uf.includes(need.uf)) out.push("REGION_MATCH");
  out.push("TICKET_MATCH");
  if (i.capacity_cents > 0) out.push("PARTNER_CAPACITY_AVAILABLE");
  if (cheapest) out.push("LOWER_ESTIMATED_COST");
  if (!i.is_domestic) {
    out.push("GLOBAL_EXPANDS_CAPACITY");
    if (i.impact_mandate && need.impact_eligible) out.push("GLOBAL_IMPACT_MANDATE_MATCH");
  }
  return REASON_ORDER.filter((r) => out.includes(r));
}

/** Best fit first; ties go to the cheaper route, then to the lower id, so a run is reproducible. */
function rank(a: InstrumentAssessment, b: InstrumentAssessment, byId: Map<string, Instrument>): number {
  if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
  const ca = byId.get(a.instrument_id)!.estimated_cost_bps ?? 0;
  const cb = byId.get(b.instrument_id)!.estimated_cost_bps ?? 0;
  if (ca !== cb) return ca - cb;
  return a.instrument_id < b.instrument_id ? -1 : 1;
}

/**
 * Matches one need against the whole network: domestic instruments first, the
 * residual offered to a global route, and whatever nothing could take left
 * standing as unfunded qualified demand.
 */
export function matchCapital(need: CapitalNeed, instruments: Instrument[]): CapitalPlan {
  if (!Number.isSafeInteger(need.amount_cents) || need.amount_cents <= 0) throw new Error("amount_cents must be a positive integer");
  if (!Number.isSafeInteger(need.term_months) || need.term_months <= 0) throw new Error("term_months must be a positive integer");

  const byId = new Map(instruments.map((i) => [i.id, i]));
  const evaluated = instruments.map((i) => assess(need, i));
  const reasons = new Set<NetworkReason>();
  const allocations: Allocation[] = [];

  // Gate 1. Readiness is the opportunity's own precondition; a run against a
  // need that never passed it produces a review, not a recommendation.
  if (!need.readiness_ok && !need.manual_review_allowed) {
    return {
      model_version: CAPITAL_NETWORK_MODEL_VERSION, evaluated, allocations: [],
      reason_codes: ["MANUAL_REVIEW_REQUIRED"], requested_cents: need.amount_cents,
      domestic_coverage_cents: 0, global_coverage_cents: 0, unfunded_cents: need.amount_cents,
      external_capital_gap_cents: need.amount_cents, status: "manual_review",
    };
  }

  const cheapest = (pool: InstrumentAssessment[]) => {
    const costs = pool.map((a) => byId.get(a.instrument_id)!.estimated_cost_bps ?? 0);
    return costs.length ? Math.min(...costs) : null;
  };

  const fill = (pool: InstrumentAssessment[], budget: number): number => {
    const low = cheapest(pool);
    let left = budget;
    for (const a of [...pool].sort((x, y) => rank(x, y, byId))) {
      if (left <= 0) break;
      const i = byId.get(a.instrument_id)!;
      const take = Math.min(a.max_takeable_cents, left);
      // A route that cannot reach its own floor is not a route for this slice.
      if (take < i.ticket_min_cents) continue;
      allocations.push({
        instrument_id: i.id, amount_cents: take, fit_score: a.fit_score,
        reasons: reasonsFor(need, i, (i.estimated_cost_bps ?? 0) === low),
        requires_partner_approval: i.requires_partner_approval, is_credit: i.is_credit,
      });
      left -= take;
    }
    return budget - left;
  };

  const eligible = evaluated.filter((a) => a.eligible);
  const domesticCovered = fill(eligible.filter((a) => byId.get(a.instrument_id)!.is_domestic), need.amount_cents);
  // The addendum's External Capital Gap: what domestic capacity could not absorb.
  const gap = need.amount_cents - domesticCovered;
  const globalCovered = gap > 0 ? fill(eligible.filter((a) => !byId.get(a.instrument_id)!.is_domestic), gap) : 0;
  const unfunded = gap - globalCovered;

  if (domesticCovered >= need.amount_cents) reasons.add("DOMESTIC_COVERAGE_SUFFICIENT");
  else if (domesticCovered > 0) reasons.add("DOMESTIC_CAPACITY_PARTIAL");
  else reasons.add("DOMESTIC_POOL_EXHAUSTED");
  for (const a of allocations) for (const r of a.reasons) reasons.add(r);
  for (const a of evaluated) for (const b of a.blocks) reasons.add(b);
  if (allocations.length === 0) reasons.add("NO_ROUTE_AVAILABLE");

  return {
    model_version: CAPITAL_NETWORK_MODEL_VERSION,
    evaluated,
    allocations,
    reason_codes: REASON_ORDER.filter((r) => reasons.has(r)),
    requested_cents: need.amount_cents,
    domestic_coverage_cents: domesticCovered,
    global_coverage_cents: globalCovered,
    unfunded_cents: unfunded,
    external_capital_gap_cents: gap,
    status: allocations.length > 0 ? "recommended" : "no_route",
  };
}
