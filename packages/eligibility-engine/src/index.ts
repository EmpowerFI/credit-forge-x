// Eligibility engine, v0 — "for this amount, on this business?"
//
// Runs only after readiness says the business is prepared and the entrepreneur
// has asked for a specific amount. It answers whether that amount fits what
// the business can repay, suggests a range and a term, and grades risk and
// confidence, with reason codes that say what would change the answer.
//
// It is not the lending decision. The financial partner keeps its own policy,
// its own underwriting and its own pricing; the reference rate below is a
// planning assumption for sizing instalments, not a price. EmpowerFI's
// eligibility and the partner's approval are stored separately.
//
// Deterministic, versioned, integers only (cents, basis points) — its result
// is committed on-chain and must re-run identically in Deno and the browser.
// Depends on nothing, including the readiness engine: it takes the few
// readiness figures it needs as plain input.

export const ELIGIBILITY_MODEL_VERSION = "eligibility-v0.1.0";

export type EligibilityDecision = "ELIGIBLE" | "ELIGIBLE_REDUCED" | "MANUAL_REVIEW" | "NOT_ELIGIBLE";
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type EligibilityReason =
  | "AFFORDABLE"
  | "AMOUNT_ABOVE_CAPACITY"
  | "NOT_CREDIT_READY"
  | "AMOUNT_OUTSIDE_PRODUCT_RANGE"
  | "NO_REPAYMENT_CAPACITY"
  | "HIGH_RISK"
  | "LOW_CONFIDENCE"
  | "VOLATILE_INCOME"
  | "DECLINING_REVENUE"
  | "HIGH_HOUSEHOLD_DRAW"
  | "SHORT_HISTORY"
  | "TIGHT_AFFORDABILITY"
  | "LOW_READINESS_BAND";

/** What eligibility needs from the latest readiness assessment. */
export interface EligibilityInput {
  readiness_status: string;
  readiness_band: string;
  requested_amount_cents: number;
  purpose: string;
  months_reported: number;
  records_kept_bps: number | null;
  inconsistencies: number;
  avg_revenue_cents: number | null;
  avg_net_business_cents: number | null;
  avg_household_cents: number | null;
  revenue_cv_bps: number | null;
  revenue_trend_bps: number | null;
  household_share_bps: number | null;
}

export interface EligibilityResult {
  model_version: string;
  decision: EligibilityDecision;
  requested_amount_cents: number;
  /** What EmpowerFI would take to a partner: the request, a reduced amount, or null. */
  proposed_amount_cents: number | null;
  term_months: number | null;
  instalment_cents: number | null;
  max_instalment_cents: number;
  /** Instalment as a share of average monthly business result. */
  affordability_bps: number | null;
  /** Repayable within six months … within twelve. */
  suggested_min_cents: number | null;
  suggested_max_cents: number | null;
  risk_band: RiskBand;
  risk_points: number;
  confidence: Confidence;
  reason_codes: EligibilityReason[];
}

export const RULES = {
  /** A planning assumption for sizing instalments — not a price. */
  REFERENCE_MONTHLY_RATE_BPS: 250,
  TERMS: [3, 6, 9, 12] as readonly number[],
  MAX_INSTALMENT_OF_NET_BPS: 3000,
  MAX_INSTALMENT_OF_FREE_CASH_BPS: 5000,
  PRODUCT_MIN_CENTS: 10_000,
  PRODUCT_MAX_CENTS: 5_000_000,
  /** Suggested amounts are whole multiples of R$ 100. */
  AMOUNT_STEP_CENTS: 10_000,
  TIGHT_AFFORDABILITY_BPS: 2000,
  VOLATILE_CV_BPS: 3000,
  VERY_VOLATILE_CV_BPS: 5000,
  DECLINING_TREND_BPS: -1000,
  HIGH_HOUSEHOLD_SHARE_BPS: 8000,
  FULL_HISTORY_MONTHS: 6,
  RISK_MEDIUM_POINTS: 2,
  RISK_HIGH_POINTS: 4,
} as const;

const REASON_ORDER: EligibilityReason[] = [
  "AFFORDABLE",
  "AMOUNT_ABOVE_CAPACITY",
  "NOT_CREDIT_READY",
  "AMOUNT_OUTSIDE_PRODUCT_RANGE",
  "NO_REPAYMENT_CAPACITY",
  "HIGH_RISK",
  "LOW_CONFIDENCE",
  "VOLATILE_INCOME",
  "DECLINING_REVENUE",
  "HIGH_HOUSEHOLD_DRAW",
  "SHORT_HISTORY",
  "TIGHT_AFFORDABILITY",
  "LOW_READINESS_BAND",
];

/** Flat instalment at the reference rate, rounded up to the cent. */
export function instalment(amountCents: number, termMonths: number): number {
  const total = amountCents * (10_000 + RULES.REFERENCE_MONTHLY_RATE_BPS * termMonths);
  return Math.ceil(total / (10_000 * termMonths));
}

/** The largest amount, in R$ 100 steps, whose instalment fits over the term. */
export function maxAmountFor(maxInstalmentCents: number, termMonths: number): number {
  if (maxInstalmentCents <= 0) return 0;
  const raw = Math.floor((maxInstalmentCents * 10_000 * termMonths) / (10_000 + RULES.REFERENCE_MONTHLY_RATE_BPS * termMonths));
  let amount = Math.min(RULES.PRODUCT_MAX_CENTS, Math.floor(raw / RULES.AMOUNT_STEP_CENTS) * RULES.AMOUNT_STEP_CENTS);
  // Rounding the instalment up can tip the edge case over; step down if so.
  while (amount > 0 && instalment(amount, termMonths) > maxInstalmentCents) amount -= RULES.AMOUNT_STEP_CENTS;
  return amount;
}

const assertInt = (v: number, name: string) => {
  if (!Number.isSafeInteger(v)) throw new Error(`${name} must be an integer`);
};

export function assessEligibility(input: EligibilityInput): EligibilityResult {
  assertInt(input.requested_amount_cents, "requested_amount_cents");
  assertInt(input.months_reported, "months_reported");

  const net = input.avg_net_business_cents ?? 0;
  const free = net - (input.avg_household_cents ?? 0);
  const maxInstalment =
    net > 0 && free > 0
      ? Math.min(
          Math.floor((net * RULES.MAX_INSTALMENT_OF_NET_BPS) / 10_000),
          Math.floor((free * RULES.MAX_INSTALMENT_OF_FREE_CASH_BPS) / 10_000),
        )
      : 0;

  const reasons = new Set<EligibilityReason>();
  const cv = input.revenue_cv_bps;
  if (cv !== null && cv > RULES.VOLATILE_CV_BPS) reasons.add("VOLATILE_INCOME");
  if (input.revenue_trend_bps !== null && input.revenue_trend_bps <= RULES.DECLINING_TREND_BPS) reasons.add("DECLINING_REVENUE");
  if ((input.household_share_bps !== null && input.household_share_bps > RULES.HIGH_HOUSEHOLD_SHARE_BPS) || (net > 0 && free <= 0)) {
    reasons.add("HIGH_HOUSEHOLD_DRAW");
  }
  if (input.months_reported < RULES.FULL_HISTORY_MONTHS) reasons.add("SHORT_HISTORY");
  if (input.readiness_band === "LOW") reasons.add("LOW_READINESS_BAND");

  const confidence: Confidence =
    input.months_reported >= RULES.FULL_HISTORY_MONTHS && input.records_kept_bps === 10_000 && input.inconsistencies === 0
      ? "HIGH"
      : input.months_reported >= 4 && input.inconsistencies === 0
        ? "MEDIUM"
        : "LOW";

  // Sizing: the request at the shortest term that fits, or else the most that
  // fits over twelve months. A request outside the product is not sized at
  // all — a "reduced" proposal for it would describe an offer nobody makes.
  const requested = input.requested_amount_cents;
  const inProduct = requested >= RULES.PRODUCT_MIN_CENTS && requested <= RULES.PRODUCT_MAX_CENTS;
  const fitsTerm = inProduct ? (RULES.TERMS.find((t) => instalment(requested, t) <= maxInstalment) ?? null) : null;
  const suggestedMax = maxAmountFor(maxInstalment, 12);
  const suggestedMin = maxAmountFor(maxInstalment, 6);
  const reducedTerm = inProduct && suggestedMax >= RULES.PRODUCT_MIN_CENTS ? 12 : null;

  let proposed: number | null = null;
  let term: number | null = null;
  if (fitsTerm !== null) {
    proposed = requested;
    term = fitsTerm;
  } else if (reducedTerm !== null) {
    proposed = suggestedMax;
    term = reducedTerm;
  }
  const instalmentCents = proposed !== null && term !== null ? instalment(proposed, term) : null;
  const affordability = instalmentCents !== null && net > 0 ? Math.round((instalmentCents * 10_000) / net) : null;
  if (affordability !== null && affordability > RULES.TIGHT_AFFORDABILITY_BPS) reasons.add("TIGHT_AFFORDABILITY");

  // Risk, as points: each is a reason the partner will want to look at.
  const riskPoints =
    (cv !== null && cv > RULES.VERY_VOLATILE_CV_BPS ? 2 : cv !== null && cv > RULES.VOLATILE_CV_BPS ? 1 : 0) +
    (reasons.has("DECLINING_REVENUE") ? 1 : 0) +
    (reasons.has("HIGH_HOUSEHOLD_DRAW") ? 1 : 0) +
    (reasons.has("SHORT_HISTORY") ? 1 : 0) +
    (reasons.has("LOW_READINESS_BAND") ? 1 : 0) +
    (reasons.has("TIGHT_AFFORDABILITY") ? 1 : 0);
  const riskBand: RiskBand =
    riskPoints >= RULES.RISK_HIGH_POINTS ? "HIGH" : riskPoints >= RULES.RISK_MEDIUM_POINTS ? "MEDIUM" : "LOW";

  // The decision, by precedence.
  let decision: EligibilityDecision;
  if (input.readiness_status !== "CREDIT_READY") {
    decision = "NOT_ELIGIBLE";
    reasons.add("NOT_CREDIT_READY");
  } else if (!inProduct) {
    decision = "NOT_ELIGIBLE";
    reasons.add("AMOUNT_OUTSIDE_PRODUCT_RANGE");
  } else if (maxInstalment <= 0 || proposed === null) {
    decision = "NOT_ELIGIBLE";
    reasons.add("NO_REPAYMENT_CAPACITY");
  } else if (riskBand === "HIGH") {
    decision = "NOT_ELIGIBLE";
    reasons.add("HIGH_RISK");
  } else if (confidence === "LOW") {
    decision = "MANUAL_REVIEW";
    reasons.add("LOW_CONFIDENCE");
  } else if (fitsTerm !== null) {
    decision = "ELIGIBLE";
    reasons.add("AFFORDABLE");
  } else {
    decision = "ELIGIBLE_REDUCED";
    reasons.add("AMOUNT_ABOVE_CAPACITY");
  }

  const takesToPartner = decision === "ELIGIBLE" || decision === "ELIGIBLE_REDUCED" || decision === "MANUAL_REVIEW";
  return {
    model_version: ELIGIBILITY_MODEL_VERSION,
    decision,
    requested_amount_cents: requested,
    proposed_amount_cents: takesToPartner ? proposed : null,
    term_months: takesToPartner ? term : null,
    instalment_cents: takesToPartner ? instalmentCents : null,
    max_instalment_cents: maxInstalment,
    affordability_bps: takesToPartner ? affordability : null,
    suggested_min_cents: suggestedMin >= RULES.PRODUCT_MIN_CENTS ? suggestedMin : null,
    suggested_max_cents: suggestedMax >= RULES.PRODUCT_MIN_CENTS ? suggestedMax : null,
    risk_band: riskBand,
    risk_points: riskPoints,
    confidence,
    reason_codes: REASON_ORDER.filter((r) => reasons.has(r)),
  };
}
