// Check-in insights, v0 — the numbers the AI report is written ABOUT, never BY.
//
// The product requirement is explicit: numeric work happens outside the
// language model, with a formula version recorded, and the model only writes
// prose over figures it is handed. This is that numeric work. It is pure,
// deterministic and versioned — the same month always yields the same
// indicators, and every result carries the version that produced it — so the
// AI layer, the fallback message and an auditor all read from one source.
//
// Integers only: money in cents, ratios in basis points, no floats, because
// 19.99 as a float times anything is not 19.99 and these numbers are a
// woman's livelihood.
//
// Two refusals that matter more than any calculation:
//
//   * It never invents a number. A cost category she did not know ("não sei")
//     arrives as null, and then the business result is null too — not a guess,
//     not a zero. A zero would read as "she spent nothing", which is a lie the
//     report would then explain confidently.
//
//   * It never judges. Every signal is a neutral machine code — revenue below
//     cost, a household draw larger than the result — for the AI to render
//     gently. "You are losing money" is not in here, and must not be in the
//     prose either; the field reports a fact, the wording stays kind.
//
// What this is not: a readiness score, an eligibility decision, or advice. It
// is one month or one week of a business, turned into the handful of figures
// a useful, honest paragraph can be built on.
//
// v0.2.0 adds the week: the daily journal is read every week, and a week is
// named by its Monday, "YYYY-MM-DD". Months are computed exactly as in v0.1.0;
// only the version moved, because the formula now answers a second question.

export const INSIGHTS_FORMULA_VERSION = "insights-v0.2.0";

/** A month is "YYYY-MM"; a week is its Monday, "YYYY-MM-DD". */
export type Span = "month" | "week";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Which kind of period this is, or an error if it is neither. */
export function spanOf(period: string): Span {
  if (MONTH.test(period)) return "month";
  if (DAY.test(period)) {
    const d = new Date(`${period}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== period) throw new Error(`not a date: ${period}`);
    if (d.getUTCDay() !== 1) throw new Error(`a week is named by its Monday: ${period}`);
    return "week";
  }
  throw new Error(`not a period: ${period}`);
}

/** One assembled month, as it rests in public.checkins, or one week of the journal. Costs may be unknown. */
export interface MonthFigures {
  /** "YYYY-MM" for a month; the Monday, "YYYY-MM-DD", for a week. */
  period: string;
  revenue_cents: number;
  /** Materials and stock. Null when she answered "não sei". */
  cogs_cents: number | null;
  /** Other business costs: rent, transport, fees. Null when unknown. */
  opex_cents: number | null;
  /** Money taken out of the business for the household. */
  household_cents: number;
  /** Whether she recorded every sale that month. */
  keeps_records: boolean;
  /** Days the business operated in the period: 0–31 for a month, 0–7 for a week. */
  active_days: number;
}

export interface InsightsInput {
  /** The month being reported. */
  current: MonthFigures;
  /**
   * The nearest earlier month to compare against, if there is one. Used only
   * for the revenue-change figure, and only when it is the immediately
   * preceding period — comparing March with last September is not a trend.
   */
  previous?: MonthFigures | null;
}

/**
 * Neutral signals. Each is a fact about the figures, never a verdict. The AI
 * turns these into supportive sentences; the fallback message maps them to
 * fixed, kind strings. The code says what is true, not what she did wrong.
 */
export type InsightFlag =
  | "REVENUE_ZERO" // no sales reported this month
  | "COST_UNKNOWN" // a cost category was "não sei", so the result cannot be computed
  | "FIGURES_ESTIMATED" // she does not keep records, so every figure is her estimate
  | "RESULT_NEGATIVE" // business cost exceeded revenue
  | "HOUSEHOLD_OVER_RESULT" // she drew more for the home than the business made
  | "HOUSEHOLD_OVER_REVENUE" // the household draw is larger than all sales — likely money mixed
  | "FEW_ACTIVE_DAYS" // the business ran very few days this month
  | "REVENUE_UP" // revenue rose materially vs the previous month
  | "REVENUE_DOWN"; // revenue fell materially vs the previous month

export type DataQuality =
  | "complete" // every category known and records kept
  | "estimated" // figures are her estimates, or the comparison is partial
  | "incomplete"; // a cost category is unknown, so no result could be formed

export interface Insights {
  formula_version: string;
  period: string;

  revenue_cents: number;
  household_cents: number;
  active_days: number;

  /** cogs + opex. Null when either category is unknown. */
  business_cost_cents: number | null;
  /** revenue − business_cost. Null when the cost is unknown; never guessed. */
  result_cents: number | null;
  /**
   * True when the result rests on her estimates rather than her records. A
   * null result is not "estimated", it is absent — this is false then.
   */
  result_is_estimated: boolean;
  /** result ÷ revenue, in basis points. Only when the result is real and revenue > 0. */
  margin_bps: number | null;

  /** The compared month and the change, when there is an immediately prior one. */
  previous_period: string | null;
  revenue_prev_cents: number | null;
  /** (revenue − prev) ÷ prev, in basis points. Null when there is nothing to compare. */
  revenue_change_bps: number | null;

  flags: InsightFlag[];
  data_quality: DataQuality;
}

export const RULES = {
  /** A month running under five days is barely open. */
  FEW_ACTIVE_DAYS: 5,
  /** A week selling on fewer than two days is barely open. */
  FEW_ACTIVE_DAYS_WEEK: 2,
  /** Below this, a revenue change is noise, not a trend. 15%. */
  MATERIAL_CHANGE_BPS: 1500,
  /** A sanity ceiling shared with the checkins table: a hundred million reais. */
  MAX_CENTS: 10_000_000_000,
} as const;

function assertCents(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > RULES.MAX_CENTS) {
    throw new Error(`${label} is not a sane cents amount: ${value}`);
  }
}

/** Integer basis points of a / b, rounded, for b > 0. */
function bps(numerator: number, denominator: number): number {
  return Math.round((numerator * 10_000) / denominator);
}

/** Are these two periods adjacent, current directly after previous? */
function isImmediatelyBefore(previous: string, current: string): boolean {
  if (DAY.test(previous) && DAY.test(current)) {
    const days = (Date.parse(`${current}T12:00:00Z`) - Date.parse(`${previous}T12:00:00Z`)) / 86_400_000;
    return days === 7;
  }
  const p = previous.match(/^(\d{4})-(\d{2})$/);
  const c = current.match(/^(\d{4})-(\d{2})$/);
  if (!p || !c) return false;
  const pi = Number(p[1]) * 12 + (Number(p[2]) - 1);
  const ci = Number(c[1]) * 12 + (Number(c[2]) - 1);
  return ci - pi === 1;
}

/**
 * Turns one month (and optionally the one before it) into the figures a report
 * is built on. Deterministic; throws only on inputs that are not figures at
 * all, never on figures that tell a hard story.
 */
export function computeInsights(input: InsightsInput): Insights {
  const m = input.current;
  const span = spanOf(m.period);
  assertCents("revenue", m.revenue_cents);
  assertCents("household", m.household_cents);
  if (m.cogs_cents !== null) assertCents("cogs", m.cogs_cents);
  if (m.opex_cents !== null) assertCents("opex", m.opex_cents);
  if (!Number.isInteger(m.active_days) || m.active_days < 0 || m.active_days > (span === "week" ? 7 : 31)) {
    throw new Error(`active_days out of range: ${m.active_days}`);
  }

  const costKnown = m.cogs_cents !== null && m.opex_cents !== null;
  const business_cost_cents = costKnown ? (m.cogs_cents as number) + (m.opex_cents as number) : null;
  const result_cents = business_cost_cents === null ? null : m.revenue_cents - business_cost_cents;
  // A result rests on estimates when she keeps no records. A null result is
  // not estimated — it is simply not there.
  const result_is_estimated = result_cents !== null && !m.keeps_records;
  const margin_bps =
    result_cents !== null && m.revenue_cents > 0 ? bps(result_cents, m.revenue_cents) : null;

  // The comparison, only against the month immediately before.
  let previous_period: string | null = null;
  let revenue_prev_cents: number | null = null;
  let revenue_change_bps: number | null = null;
  const prev = input.previous ?? null;
  if (prev && isImmediatelyBefore(prev.period, m.period)) {
    assertCents("previous revenue", prev.revenue_cents);
    previous_period = prev.period;
    revenue_prev_cents = prev.revenue_cents;
    if (prev.revenue_cents > 0) revenue_change_bps = bps(m.revenue_cents - prev.revenue_cents, prev.revenue_cents);
  }

  const flags: InsightFlag[] = [];
  if (m.revenue_cents === 0) flags.push("REVENUE_ZERO");
  if (!costKnown) flags.push("COST_UNKNOWN");
  if (result_is_estimated) flags.push("FIGURES_ESTIMATED");
  if (result_cents !== null && result_cents < 0) flags.push("RESULT_NEGATIVE");
  if (result_cents !== null && result_cents >= 0 && m.household_cents > result_cents) {
    flags.push("HOUSEHOLD_OVER_RESULT");
  }
  // Independent of the result: a home draw larger than every sale is the sign
  // of business and household money moving as one, which is the thing the
  // product most wants to help her separate.
  if (m.revenue_cents > 0 && m.household_cents > m.revenue_cents) flags.push("HOUSEHOLD_OVER_REVENUE");
  if (m.active_days < (span === "week" ? RULES.FEW_ACTIVE_DAYS_WEEK : RULES.FEW_ACTIVE_DAYS)) flags.push("FEW_ACTIVE_DAYS");
  if (revenue_change_bps !== null && revenue_change_bps >= RULES.MATERIAL_CHANGE_BPS) flags.push("REVENUE_UP");
  if (revenue_change_bps !== null && revenue_change_bps <= -RULES.MATERIAL_CHANGE_BPS) flags.push("REVENUE_DOWN");

  const data_quality: DataQuality = !costKnown ? "incomplete" : m.keeps_records ? "complete" : "estimated";

  return {
    formula_version: INSIGHTS_FORMULA_VERSION,
    period: m.period,
    revenue_cents: m.revenue_cents,
    household_cents: m.household_cents,
    active_days: m.active_days,
    business_cost_cents,
    result_cents,
    result_is_estimated,
    margin_bps,
    previous_period,
    revenue_prev_cents,
    revenue_change_bps,
    flags,
    data_quality,
  };
}
