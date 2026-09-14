// Readiness engine, v0 — "is this business prepared?"
//
// Deterministic and versioned: the same inputs always produce the same result,
// and every result carries the model version that produced it. It runs in
// Deno (the Edge Function that records assessments) and in the browser (the
// audit screen re-runs it on the stored features), so it depends on nothing.
//
// Two stages, kept apart so each can be checked on its own:
//   computeFeatures(raw)   history → a small, stored feature snapshot
//   evaluateReadiness(f)   features → status, band, missing requirements, reasons
//
// Integers only, everywhere: money in cents, ratios in basis points. Features
// and results are hashed into commitments, and canonical JSON refuses floats.
//
// What this is not: an eligibility decision, a credit score, or a prediction
// of default. It answers whether the business is prepared to have a credit
// conversation at all. Eligibility, for a specific amount, is a separate
// engine; approval belongs to the financial partner. And it never sees
// engagement data — opens, clicks or time in the app are not preparation.

export const READINESS_MODEL_VERSION = "readiness-v0.1.0";

/** One month of the business, as the entrepreneur reported it. */
export interface CheckinRecord {
  /** "YYYY-MM". */
  period: string;
  revenue_cents: number;
  /** Materials, stock and inputs. */
  cogs_cents: number;
  /** Other business costs: rent, transport, fees. */
  opex_cents: number;
  /** Money taken out of the business for the household. */
  household_cents: number;
  /** Whether she recorded every sale that month. */
  keeps_records: boolean;
  /** Days the business operated, 0–31. */
  active_days: number;
}

export interface ReadinessRawInput {
  /** The month the assessment is made in, "YYYY-MM". */
  as_of_period: string;
  /** Member of at least one verified community. */
  community_verified: boolean;
  /** EmpowerFI's core preparation programme. */
  core_modules_total: number;
  core_modules_completed: number;
  /** Any order, at most one per period. */
  checkins: CheckinRecord[];
}

export interface ReadinessFeatures {
  as_of_period: string;
  community_verified: boolean;
  core_modules_total: number;
  core_modules_completed: number;
  /** Check-ins in the six months up to and including as_of_period. */
  months_reported: number;
  /** Unbroken run of monthly check-ins ending at the latest one. */
  consecutive_months: number;
  latest_period: string | null;
  /** Months between the latest check-in and as_of_period; null with no check-ins. */
  months_since_last: number | null;
  /** Share of window check-ins where every sale was recorded. */
  records_kept_bps: number | null;
  avg_revenue_cents: number | null;
  /** Revenue minus materials and other business costs, before household draws. */
  avg_net_business_cents: number | null;
  avg_household_cents: number | null;
  /** Of the latest three check-ins, how many had a positive net business result. */
  positive_months_last3: number;
  /** Coefficient of variation of revenue; null under three months. */
  revenue_cv_bps: number | null;
  /** Recent half against earlier half of the window; null under four months. */
  revenue_trend_bps: number | null;
  /** Household draws as a share of net business result; null when that is not positive. */
  household_share_bps: number | null;
  /** Check-ins whose figures contradict each other. */
  inconsistencies: number;
}

export type ReadinessStatus = "CREDIT_READY" | "NEEDS_MORE_DATA" | "NEEDS_PREPARATION" | "MANUAL_REVIEW";
export type ReadinessBand = "LOW" | "MEDIUM" | "HIGH";

export type RequirementCode =
  | "COMMUNITY_NOT_VERIFIED"
  | "CORE_EDUCATION_INCOMPLETE"
  | "RECORD_KEEPING"
  | "CASH_FLOW_NOT_POSITIVE"
  | "INSUFFICIENT_HISTORY"
  | "IRREGULAR_REPORTING"
  | "STALE_REPORTING";

export type ReasonCode =
  | "EDUCATION_COMPLETE"
  | "KEEPS_RECORDS"
  | "CONSISTENT_REPORTING"
  | "POSITIVE_CASH_FLOW"
  | "STEADY_REVENUE"
  | "GROWING_REVENUE"
  | "DECLINING_REVENUE"
  | "VOLATILE_REVENUE"
  | "HIGH_HOUSEHOLD_DRAW"
  | "DATA_INCONSISTENT";

export interface MissingRequirement {
  code: RequirementCode;
  /** Where she is now, in the requirement's own unit (months, modules, bps …). */
  current: number | null;
  /** What the requirement asks for, in the same unit. */
  required: number;
}

export interface ReadinessResult {
  model_version: string;
  status: ReadinessStatus;
  band: ReadinessBand;
  /** 0–100, the sum of the four components. Never written on-chain. */
  score: number;
  components: { preparation: number; regularity: number; data_quality: number; business: number };
  missing_requirements: MissingRequirement[];
  reason_codes: ReasonCode[];
}

/** The rules' thresholds, in one place and in the model version's scope. */
export const RULES = {
  WINDOW_MONTHS: 6,
  MIN_MONTHS_REPORTED: 3,
  MIN_CONSECUTIVE_MONTHS: 3,
  MAX_MONTHS_SINCE_LAST: 1,
  MIN_RECORDS_KEPT_BPS: 6667,
  MIN_POSITIVE_MONTHS_LAST3: 2,
  /** Revenue this erratic is past what fixed rules should judge alone. */
  MANUAL_REVIEW_CV_BPS: 8000,
  MANUAL_REVIEW_INCONSISTENCIES: 2,
  VOLATILE_CV_BPS: 5000,
  STEADY_CV_BPS: 3000,
  TREND_BPS: 1000,
  HIGH_HOUSEHOLD_SHARE_BPS: 8000,
  BAND_HIGH: 75,
  BAND_MEDIUM: 50,
} as const;

const REQUIREMENT_ORDER: RequirementCode[] = [
  "COMMUNITY_NOT_VERIFIED",
  "CORE_EDUCATION_INCOMPLETE",
  "RECORD_KEEPING",
  "CASH_FLOW_NOT_POSITIVE",
  "INSUFFICIENT_HISTORY",
  "IRREGULAR_REPORTING",
  "STALE_REPORTING",
];
const PREPARATION: RequirementCode[] = [
  "COMMUNITY_NOT_VERIFIED",
  "CORE_EDUCATION_INCOMPLETE",
  "RECORD_KEEPING",
  "CASH_FLOW_NOT_POSITIVE",
];
const REASON_ORDER: ReasonCode[] = [
  "EDUCATION_COMPLETE",
  "KEEPS_RECORDS",
  "CONSISTENT_REPORTING",
  "POSITIVE_CASH_FLOW",
  "STEADY_REVENUE",
  "GROWING_REVENUE",
  "DECLINING_REVENUE",
  "VOLATILE_REVENUE",
  "HIGH_HOUSEHOLD_DRAW",
  "DATA_INCONSISTENT",
];

// ------------------------------------------------------------------ periods

const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Months since year 0, so two periods subtract into a month count. */
export function periodIndex(period: string): number {
  const m = PERIOD.exec(period);
  if (!m) throw new Error(`invalid period "${period}", expected YYYY-MM`);
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

const assertCents = (value: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer (cents)`);
};

// ----------------------------------------------------------------- features

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const bps = (numerator: number, denominator: number) => Math.round((numerator * 10_000) / denominator);

export function computeFeatures(raw: ReadinessRawInput): ReadinessFeatures {
  const asOf = periodIndex(raw.as_of_period);
  const seen = new Set<number>();
  for (const c of raw.checkins) {
    const p = periodIndex(c.period);
    if (seen.has(p)) throw new Error(`two check-ins for ${c.period}`);
    seen.add(p);
    if (p > asOf) throw new Error(`check-in for ${c.period} is after ${raw.as_of_period}`);
    assertCents(c.revenue_cents, "revenue_cents");
    assertCents(c.cogs_cents, "cogs_cents");
    assertCents(c.opex_cents, "opex_cents");
    assertCents(c.household_cents, "household_cents");
    if (!Number.isInteger(c.active_days) || c.active_days < 0 || c.active_days > 31) {
      throw new Error("active_days must be 0–31");
    }
  }

  // Newest first.
  const all = [...raw.checkins].sort((a, b) => periodIndex(b.period) - periodIndex(a.period));
  const window = all.filter((c) => asOf - periodIndex(c.period) < RULES.WINDOW_MONTHS);

  let consecutive = all.length ? 1 : 0;
  for (let i = 1; i < all.length && periodIndex(all[i - 1].period) - periodIndex(all[i].period) === 1; i++) {
    consecutive++;
  }

  const net = (c: CheckinRecord) => c.revenue_cents - c.cogs_cents - c.opex_cents;
  const revenues = window.map((c) => c.revenue_cents);
  const avgRevenue = window.length ? mean(revenues) : null;
  const avgNet = window.length ? mean(window.map(net)) : null;
  const avgHousehold = window.length ? mean(window.map((c) => c.household_cents)) : null;

  let cv: number | null = null;
  if (window.length >= 3 && avgRevenue! > 0) {
    const variance = mean(revenues.map((r) => (r - avgRevenue!) * (r - avgRevenue!)));
    cv = bps(Math.sqrt(variance), avgRevenue!);
  }

  let trend: number | null = null;
  if (window.length >= 4) {
    const oldestFirst = [...window].reverse();
    const half = Math.floor(oldestFirst.length / 2);
    const earlier = mean(oldestFirst.slice(0, half).map((c) => c.revenue_cents));
    const recent = mean(oldestFirst.slice(half).map((c) => c.revenue_cents));
    if (earlier > 0) trend = bps(recent - earlier, earlier);
  }

  const inconsistencies = window.filter(
    (c) =>
      (c.revenue_cents > 0 && c.cogs_cents + c.opex_cents > 3 * c.revenue_cents) ||
      (c.revenue_cents === 0 && c.active_days >= 15),
  ).length;

  return {
    as_of_period: raw.as_of_period,
    community_verified: raw.community_verified,
    core_modules_total: raw.core_modules_total,
    core_modules_completed: Math.min(raw.core_modules_completed, raw.core_modules_total),
    months_reported: window.length,
    consecutive_months: consecutive,
    latest_period: all[0]?.period ?? null,
    months_since_last: all.length ? asOf - periodIndex(all[0].period) : null,
    records_kept_bps: window.length ? bps(window.filter((c) => c.keeps_records).length, window.length) : null,
    avg_revenue_cents: avgRevenue === null ? null : Math.round(avgRevenue),
    avg_net_business_cents: avgNet === null ? null : Math.round(avgNet),
    avg_household_cents: avgHousehold === null ? null : Math.round(avgHousehold),
    positive_months_last3: window.slice(0, 3).filter((c) => net(c) > 0).length,
    revenue_cv_bps: cv,
    revenue_trend_bps: trend,
    household_share_bps: avgNet !== null && avgNet > 0 ? bps(avgHousehold!, avgNet) : null,
    inconsistencies,
  };
}

// ----------------------------------------------------------------- the rules

export function evaluateReadiness(f: ReadinessFeatures): ReadinessResult {
  const missing: MissingRequirement[] = [];
  const need = (code: RequirementCode, current: number | null, required: number) =>
    missing.push({ code, current, required });

  if (!f.community_verified) need("COMMUNITY_NOT_VERIFIED", 0, 1);
  if (f.core_modules_completed < f.core_modules_total) {
    need("CORE_EDUCATION_INCOMPLETE", f.core_modules_completed, f.core_modules_total);
  }
  if (f.records_kept_bps !== null && f.records_kept_bps < RULES.MIN_RECORDS_KEPT_BPS) {
    need("RECORD_KEEPING", f.records_kept_bps, RULES.MIN_RECORDS_KEPT_BPS);
  }
  // Only judged once there is enough history to judge it on; before that,
  // the missing history is the thing to fix.
  const enoughHistory = f.months_reported >= RULES.MIN_MONTHS_REPORTED;
  if (enoughHistory && (f.positive_months_last3 < RULES.MIN_POSITIVE_MONTHS_LAST3 || f.avg_net_business_cents! <= 0)) {
    need("CASH_FLOW_NOT_POSITIVE", f.positive_months_last3, RULES.MIN_POSITIVE_MONTHS_LAST3);
  }
  if (!enoughHistory) need("INSUFFICIENT_HISTORY", f.months_reported, RULES.MIN_MONTHS_REPORTED);
  if (f.consecutive_months < RULES.MIN_CONSECUTIVE_MONTHS) {
    need("IRREGULAR_REPORTING", f.consecutive_months, RULES.MIN_CONSECUTIVE_MONTHS);
  }
  if (f.months_since_last === null || f.months_since_last > RULES.MAX_MONTHS_SINCE_LAST) {
    need("STALE_REPORTING", f.months_since_last, RULES.MAX_MONTHS_SINCE_LAST);
  }
  missing.sort((a, b) => REQUIREMENT_ORDER.indexOf(a.code) - REQUIREMENT_ORDER.indexOf(b.code));

  const reasons = new Set<ReasonCode>();
  if (f.core_modules_total > 0 && f.core_modules_completed === f.core_modules_total) reasons.add("EDUCATION_COMPLETE");
  if (f.records_kept_bps === 10_000) reasons.add("KEEPS_RECORDS");
  if (f.consecutive_months >= RULES.WINDOW_MONTHS) reasons.add("CONSISTENT_REPORTING");
  if (f.months_reported >= 3 && f.positive_months_last3 === 3) reasons.add("POSITIVE_CASH_FLOW");
  if (f.revenue_cv_bps !== null && f.revenue_cv_bps <= RULES.STEADY_CV_BPS) reasons.add("STEADY_REVENUE");
  if (f.revenue_cv_bps !== null && f.revenue_cv_bps > RULES.VOLATILE_CV_BPS) reasons.add("VOLATILE_REVENUE");
  if (f.revenue_trend_bps !== null && f.revenue_trend_bps >= RULES.TREND_BPS) reasons.add("GROWING_REVENUE");
  if (f.revenue_trend_bps !== null && f.revenue_trend_bps <= -RULES.TREND_BPS) reasons.add("DECLINING_REVENUE");
  if (f.household_share_bps !== null && f.household_share_bps > RULES.HIGH_HOUSEHOLD_SHARE_BPS) {
    reasons.add("HIGH_HOUSEHOLD_DRAW");
  }
  if (f.inconsistencies > 0) reasons.add("DATA_INCONSISTENT");

  // Status, by precedence. No data at all is simply no data; figures the
  // rules cannot trust go to a person; then preparation before more data.
  let status: ReadinessStatus;
  if (f.months_reported === 0) status = "NEEDS_MORE_DATA";
  else if (
    f.inconsistencies >= RULES.MANUAL_REVIEW_INCONSISTENCIES ||
    (f.revenue_cv_bps !== null && f.revenue_cv_bps > RULES.MANUAL_REVIEW_CV_BPS)
  ) status = "MANUAL_REVIEW";
  else if (missing.some((m) => PREPARATION.includes(m.code))) status = "NEEDS_PREPARATION";
  else if (missing.length > 0) status = "NEEDS_MORE_DATA";
  else status = "CREDIT_READY";

  // Components, 0–25 each, in integer arithmetic.
  const eduPoints = f.core_modules_total > 0 ? Math.floor((15 * f.core_modules_completed) / f.core_modules_total) : 0;
  const preparation =
    (f.community_verified ? 5 : 0) + eduPoints + Math.floor((5 * (f.records_kept_bps ?? 0)) / 10_000);
  const stale = f.months_since_last !== null && f.months_since_last > RULES.MAX_MONTHS_SINCE_LAST;
  const regularity = Math.max(
    0,
    Math.floor((15 * Math.min(f.months_reported, 6)) / 6) +
      Math.floor((10 * Math.min(f.consecutive_months, 6)) / 6) -
      (stale ? 10 : 0),
  );
  const volatility = f.revenue_cv_bps !== null && f.revenue_cv_bps > RULES.VOLATILE_CV_BPS ? 5 : 0;
  const data_quality = f.months_reported === 0 ? 0 : Math.max(0, 25 - 8 * f.inconsistencies - volatility);
  const trendPoints =
    f.revenue_trend_bps === null ? 3
    : f.revenue_trend_bps >= RULES.TREND_BPS ? 7
    : f.revenue_trend_bps <= -RULES.TREND_BPS ? 0
    : 4;
  const business =
    f.months_reported === 0
      ? 0
      : Math.floor((10 * Math.min(f.positive_months_last3, 3)) / 3) +
        (f.avg_net_business_cents !== null && f.avg_net_business_cents > 0 ? 8 : 0) +
        trendPoints;

  const score = preparation + regularity + data_quality + business;
  const band: ReadinessBand = score >= RULES.BAND_HIGH ? "HIGH" : score >= RULES.BAND_MEDIUM ? "MEDIUM" : "LOW";

  return {
    model_version: READINESS_MODEL_VERSION,
    status,
    band,
    score,
    components: { preparation, regularity, data_quality, business },
    missing_requirements: missing,
    reason_codes: REASON_ORDER.filter((r) => reasons.has(r)),
  };
}

/** Both stages. */
export function assessReadiness(raw: ReadinessRawInput): { features: ReadinessFeatures; result: ReadinessResult } {
  const features = computeFeatures(raw);
  return { features, result: evaluateReadiness(features) };
}
