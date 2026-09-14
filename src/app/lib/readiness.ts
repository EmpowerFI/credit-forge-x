import type { Database } from "./platform.types";

export type ReadinessStatus = Database["public"]["Enums"]["readiness_status"];
export type CreditPurpose = Database["public"]["Enums"]["credit_purpose"];

// The engine speaks in codes (packages/readiness-engine); people read these.

export const STATUS_LABEL: Record<ReadinessStatus, { title: string; summary: string; tone: string }> = {
  CREDIT_READY: {
    title: "Ready for credit",
    summary: "The business is prepared, with enough data behind the judgement.",
    tone: "tone-positive",
  },
  NEEDS_MORE_DATA: {
    title: "Needs more data",
    summary: "The business is running; the record of it is still too thin.",
    tone: "tone-info",
  },
  NEEDS_PREPARATION: {
    title: "Needs more preparation",
    summary: "Organisation or education is still in progress.",
    tone: "tone-caution",
  },
  MANUAL_REVIEW: {
    title: "Manual review",
    summary: "The figures need a person to look at them before the rules decide.",
    tone: "tone-neutral",
  },
};

interface Requirement {
  code: string;
  current: number | null;
  required: number;
}

export function describeRequirement(r: Requirement): string {
  switch (r.code) {
    case "COMMUNITY_NOT_VERIFIED":
      return "Join a community EmpowerFI has verified.";
    case "CORE_EDUCATION_INCOMPLETE":
      return `Finish the credit readiness programme — ${r.current ?? 0} of ${r.required} modules done.`;
    case "RECORD_KEEPING":
      return `Record every sale — you did in ${Math.round((r.current ?? 0) / 100)}% of recent months; two in three is the bar.`;
    case "CASH_FLOW_NOT_POSITIVE":
      return `Bring in more than the business spends — ${r.current ?? 0} of your last 3 months were positive; ${r.required} are needed.`;
    case "INSUFFICIENT_HISTORY":
      return `Report more months — ${r.current ?? 0} so far in the last six; ${r.required} are needed.`;
    case "IRREGULAR_REPORTING":
      return `Report month after month — your current run is ${r.current ?? 0}; ${r.required} in a row are needed.`;
    case "STALE_REPORTING":
      return r.current === null
        ? "Send your first monthly check-in."
        : `Report this month — your last check-in was ${r.current} months ago.`;
    default:
      return r.code;
  }
}

export const REASON_LABEL: Record<string, { text: string; positive: boolean }> = {
  EDUCATION_COMPLETE: { text: "Readiness programme completed", positive: true },
  KEEPS_RECORDS: { text: "Every sale recorded", positive: true },
  CONSISTENT_REPORTING: { text: "Six months reported in a row", positive: true },
  POSITIVE_CASH_FLOW: { text: "Positive cash flow, three months running", positive: true },
  STEADY_REVENUE: { text: "Steady revenue", positive: true },
  GROWING_REVENUE: { text: "Revenue growing", positive: true },
  DECLINING_REVENUE: { text: "Revenue falling", positive: false },
  VOLATILE_REVENUE: { text: "Revenue swings a lot", positive: false },
  HIGH_HOUSEHOLD_DRAW: { text: "Most of the profit goes to the household", positive: false },
  DATA_INCONSISTENT: { text: "Some figures contradict each other", positive: false },
};

export const PURPOSE_LABEL: Record<CreditPurpose, string> = {
  working_capital: "Working capital",
  inventory: "Stock and materials",
  equipment: "Equipment",
  renovation: "Improving the workspace",
  other: "Something else",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? "—" : brl.format(cents / 100));

/** "2026-09" → "Sep 2026". */
export const monthLabel = (period: string) =>
  new Date(`${period}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
