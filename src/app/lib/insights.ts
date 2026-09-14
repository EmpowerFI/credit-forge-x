import type { ReadinessFeatures } from "@empowerfi/readiness-engine";

// Plain-language observations about the business, written by rules from the
// readiness features — the deterministic baseline any AI-written insight
// would have to beat (plan: templates first). Same features, same sentences.
// Observations only: nothing here is advice to borrow.

export interface Insight {
  tone: "good" | "watch" | "neutral";
  text: string;
}

const pct = (bps: number) => Math.round(Math.abs(bps) / 100);

export function insightsFrom(f: ReadinessFeatures): Insight[] {
  const out: Insight[] = [];

  if (f.revenue_trend_bps !== null) {
    if (f.revenue_trend_bps >= 500) {
      out.push({ tone: "good", text: `Sales in recent months are ${pct(f.revenue_trend_bps)}% above the months before.` });
    } else if (f.revenue_trend_bps <= -500) {
      out.push({ tone: "watch", text: `Sales in recent months are ${pct(f.revenue_trend_bps)}% below the months before.` });
    } else {
      out.push({ tone: "neutral", text: "Sales have held roughly level over the last months." });
    }
  }

  if (f.avg_net_business_cents !== null && f.avg_net_business_cents <= 0) {
    out.push({ tone: "watch", text: "On average the business has been spending more than it sells. Costs are the first place to look." });
  } else if (f.household_share_bps !== null && f.household_share_bps > 8000) {
    out.push({
      tone: "watch",
      text: `About ${pct(f.household_share_bps)}% of what the business makes goes to the household. Leaving a little more in the business builds a cushion for slow months.`,
    });
  } else if (f.household_share_bps !== null) {
    out.push({ tone: "good", text: `The business keeps about ${100 - pct(f.household_share_bps)}% of what it makes after household expenses.` });
  }

  if (f.revenue_cv_bps !== null && f.revenue_cv_bps > 5000) {
    out.push({ tone: "watch", text: "Sales swing a lot from month to month. A small reserve helps through the low months." });
  }

  if (f.consecutive_months >= 6) {
    out.push({ tone: "good", text: "Six months reported in a row: that record is what makes the business legible." });
  } else if (f.months_since_last !== null && f.months_since_last > 1) {
    out.push({ tone: "watch", text: `The last check-in was ${f.months_since_last} months ago. Reporting this month restarts the record.` });
  }

  return out;
}
