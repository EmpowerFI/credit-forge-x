// Readiness engine, v0.2.0 — preparation as evidence, not attendance.
//
// NOT WIRED IN. Nothing imports this but its own tests. `index.ts` is still
// the engine the app, the Edge Functions and the audit screen run, and it is
// byte-identical to its copy under platform/supabase/functions/_shared/, which
// a vitest check enforces. This file exists so the work is done and pinned
// before the hackathon freeze lifts; wiring it is a separate change that bumps
// the model version on live attestations.
//
// Why it exists, measured: v0.1.0 asks whether she completed *EmpowerFI's*
// modules, and core_modules_total is computed globally as "programmes with no
// community". A community that runs its own preparation therefore has members
// who complete none of it, which raises CORE_EDUCATION_INCOMPLETE, which is in
// the PREPARATION list, which pins the status at NEEDS_PREPARATION for good —
// so attest_eligibility refuses on chain, and the connection to capital is the
// one thing the product structurally cannot give that community.
// See docs/STUDY-ACCESS.md §1.
//
// What changes, and nothing else:
//   - CORE_EDUCATION_INCOMPLETE  ->  PREPARATION_NOT_EVIDENCED
//   - three admissible routes instead of one, below
//   - the route that satisfied it travels in the result, so a lender can
//     weigh it rather than discover it
//
// What does not change: every threshold, every other requirement, every other
// reason code, and all four components' arithmetic. `sameAsV1WhenTaught` in
// the tests holds that: for any input whose preparation comes from the core
// programme, v2 and v1 must agree on everything but the model version.
//
// The duplication of evaluateReadiness below is the freeze's cost, not a
// design: index.ts cannot be refactored to share code without changing its
// bytes. When v2 is wired, v1 retires and the copy goes with it.

import {
  computeFeatures,
  RULES,
  type CheckinRecord,
  type MissingRequirement,
  type ReadinessBand,
  type ReadinessFeatures,
  type ReadinessRawInput,
  type ReadinessStatus,
  type ReasonCode,
} from "./index";

export const READINESS_MODEL_VERSION_V2 = "readiness-v0.2.0";

export type { CheckinRecord };

/**
 * Which evidence satisfied preparation. Ordered: the strongest route she
 * actually holds is the one named, so a lender reading CORE knows there was no
 * need to fall back, and one reading DEMONSTRATED knows no programme was
 * involved at all.
 */
export type PreparationEvidence = "CORE" | "COMMUNITY_EQUIVALENT" | "DEMONSTRATED" | "NONE";

export interface ReadinessRawInputV2 extends ReadinessRawInput {
  /**
   * A community's own preparation programme, counted only once EmpowerFI has
   * reviewed it and marked it equivalent to the core track. The review is what
   * keeps the score comparable between communities: without it, three easy
   * modules and twelve hard ones would both read as "complete".
   *
   * Zero for a member of a community with no reviewed programme, which is the
   * same as not having one.
   */
  equivalent_modules_total: number;
  equivalent_modules_completed: number;
}

export interface ReadinessFeaturesV2 extends ReadinessFeatures {
  equivalent_modules_total: number;
  equivalent_modules_completed: number;
}

export type RequirementCodeV2 =
  | "COMMUNITY_NOT_VERIFIED"
  | "PREPARATION_NOT_EVIDENCED"
  | "RECORD_KEEPING"
  | "CASH_FLOW_NOT_POSITIVE"
  | "INSUFFICIENT_HISTORY"
  | "IRREGULAR_REPORTING"
  | "STALE_REPORTING";

export interface MissingRequirementV2 extends Omit<MissingRequirement, "code"> {
  code: RequirementCodeV2;
}

export interface ReadinessResultV2 {
  model_version: string;
  status: ReadinessStatus;
  band: ReadinessBand;
  score: number;
  components: { preparation: number; regularity: number; data_quality: number; business: number };
  missing_requirements: MissingRequirementV2[];
  reason_codes: ReasonCode[];
  /** Provenance of the preparation, for the attestation payload. */
  preparation_evidence: PreparationEvidence;
}

/**
 * The demonstration route's bar, deliberately above the RECORD_KEEPING
 * requirement it would otherwise overlap with (6667 bps, three months). It
 * stands in for a whole taught programme, so it asks for the full window
 * unbroken, every sale recorded in every month of it, and nothing in the
 * figures contradicting anything else.
 */
export const RULES_V2 = {
  ...RULES,
  DEMONSTRATED_MIN_CONSECUTIVE_MONTHS: RULES.WINDOW_MONTHS,
  DEMONSTRATED_RECORDS_KEPT_BPS: 10_000,
  DEMONSTRATED_MAX_INCONSISTENCIES: 0,
} as const;

const REQUIREMENT_ORDER_V2: RequirementCodeV2[] = [
  "COMMUNITY_NOT_VERIFIED",
  "PREPARATION_NOT_EVIDENCED",
  "RECORD_KEEPING",
  "CASH_FLOW_NOT_POSITIVE",
  "INSUFFICIENT_HISTORY",
  "IRREGULAR_REPORTING",
  "STALE_REPORTING",
];
const PREPARATION_V2: RequirementCodeV2[] = [
  "COMMUNITY_NOT_VERIFIED",
  "PREPARATION_NOT_EVIDENCED",
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

// ----------------------------------------------------------------- features

export function computeFeaturesV2(raw: ReadinessRawInputV2): ReadinessFeaturesV2 {
  if (!Number.isInteger(raw.equivalent_modules_total) || raw.equivalent_modules_total < 0) {
    throw new Error("equivalent_modules_total must be a non-negative integer");
  }
  if (!Number.isInteger(raw.equivalent_modules_completed) || raw.equivalent_modules_completed < 0) {
    throw new Error("equivalent_modules_completed must be a non-negative integer");
  }
  return {
    ...computeFeatures(raw),
    equivalent_modules_total: raw.equivalent_modules_total,
    // Clamped the way computeFeatures clamps the core count.
    equivalent_modules_completed: Math.min(raw.equivalent_modules_completed, raw.equivalent_modules_total),
  };
}

/** Whether her own reporting, on its own, evidences preparation. */
export function demonstratesPreparation(f: ReadinessFeaturesV2): boolean {
  return (
    f.records_kept_bps !== null &&
    f.records_kept_bps >= RULES_V2.DEMONSTRATED_RECORDS_KEPT_BPS &&
    f.consecutive_months >= RULES_V2.DEMONSTRATED_MIN_CONSECUTIVE_MONTHS &&
    f.inconsistencies <= RULES_V2.DEMONSTRATED_MAX_INCONSISTENCIES
  );
}

/** Which route satisfied preparation, strongest first. */
export function preparationEvidence(f: ReadinessFeaturesV2): PreparationEvidence {
  if (f.core_modules_total > 0 && f.core_modules_completed === f.core_modules_total) return "CORE";
  if (f.equivalent_modules_total > 0 && f.equivalent_modules_completed === f.equivalent_modules_total) {
    return "COMMUNITY_EQUIVALENT";
  }
  if (demonstratesPreparation(f)) return "DEMONSTRATED";
  return "NONE";
}

// ---------------------------------------------------------------- the rules

export function evaluateReadinessV2(f: ReadinessFeaturesV2): ReadinessResultV2 {
  const missing: MissingRequirementV2[] = [];
  const need = (code: RequirementCodeV2, current: number | null, required: number) =>
    missing.push({ code, current, required });

  const evidence = preparationEvidence(f);
  const taughtTotal = Math.max(f.core_modules_total, f.equivalent_modules_total);

  if (!f.community_verified) need("COMMUNITY_NOT_VERIFIED", 0, 1);
  if (evidence === "NONE") {
    // Reported in the unit of the route she is closest to: modules where a
    // taught programme exists, months of unbroken reporting where none does.
    if (taughtTotal > 0) {
      need("PREPARATION_NOT_EVIDENCED", Math.max(f.core_modules_completed, f.equivalent_modules_completed), taughtTotal);
    } else {
      need("PREPARATION_NOT_EVIDENCED", f.consecutive_months, RULES_V2.DEMONSTRATED_MIN_CONSECUTIVE_MONTHS);
    }
  }
  if (f.records_kept_bps !== null && f.records_kept_bps < RULES.MIN_RECORDS_KEPT_BPS) {
    need("RECORD_KEEPING", f.records_kept_bps, RULES.MIN_RECORDS_KEPT_BPS);
  }
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
  missing.sort((a, b) => REQUIREMENT_ORDER_V2.indexOf(a.code) - REQUIREMENT_ORDER_V2.indexOf(b.code));

  const reasons = new Set<ReasonCode>();
  // Unchanged in meaning: a taught programme was completed. Which one, and
  // whether it was a programme at all, is preparation_evidence's job.
  if (evidence === "CORE" || evidence === "COMMUNITY_EQUIVALENT") reasons.add("EDUCATION_COMPLETE");
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

  let status: ReadinessStatus;
  if (f.months_reported === 0) status = "NEEDS_MORE_DATA";
  else if (
    f.inconsistencies >= RULES.MANUAL_REVIEW_INCONSISTENCIES ||
    (f.revenue_cv_bps !== null && f.revenue_cv_bps > RULES.MANUAL_REVIEW_CV_BPS)
  ) status = "MANUAL_REVIEW";
  else if (missing.some((m) => PREPARATION_V2.includes(m.code))) status = "NEEDS_PREPARATION";
  else if (missing.length > 0) status = "NEEDS_MORE_DATA";
  else status = "CREDIT_READY";

  // Components, 0–25 each, in integer arithmetic. The three routes score the
  // same: differentiating them is guesswork until there is repayment data to
  // calibrate against, and v1 is an informed prior either way.
  const eduPoints =
    evidence !== "NONE"
      ? 15
      : Math.max(
          f.core_modules_total > 0 ? Math.floor((15 * f.core_modules_completed) / f.core_modules_total) : 0,
          f.equivalent_modules_total > 0
            ? Math.floor((15 * f.equivalent_modules_completed) / f.equivalent_modules_total)
            : 0,
        );
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
    model_version: READINESS_MODEL_VERSION_V2,
    status,
    band,
    score,
    components: { preparation, regularity, data_quality, business },
    missing_requirements: missing,
    reason_codes: REASON_ORDER.filter((r) => reasons.has(r)),
    preparation_evidence: evidence,
  };
}

/** Both stages. */
export function assessReadinessV2(raw: ReadinessRawInputV2): {
  features: ReadinessFeaturesV2;
  result: ReadinessResultV2;
} {
  const features = computeFeaturesV2(raw);
  return { features, result: evaluateReadinessV2(features) };
}
