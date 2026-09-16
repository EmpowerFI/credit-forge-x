import type { ReadinessFeatures } from "@empowerfi/readiness-engine";
import { tr } from "../i18n";

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
      const p = pct(f.revenue_trend_bps);
      out.push({
        tone: "good",
        text: tr({ en: `Sales in recent months are ${p}% above the months before.`, pt: `As vendas dos últimos meses estão ${p}% acima dos meses anteriores.` }),
      });
    } else if (f.revenue_trend_bps <= -500) {
      const p = pct(f.revenue_trend_bps);
      out.push({
        tone: "watch",
        text: tr({ en: `Sales in recent months are ${p}% below the months before.`, pt: `As vendas dos últimos meses estão ${p}% abaixo dos meses anteriores.` }),
      });
    } else {
      out.push({
        tone: "neutral",
        text: tr({ en: "Sales have held roughly level over the last months.", pt: "As vendas ficaram mais ou menos estáveis nos últimos meses." }),
      });
    }
  }

  if (f.avg_net_business_cents !== null && f.avg_net_business_cents <= 0) {
    out.push({
      tone: "watch",
      text: tr({
        en: "On average the business has been spending more than it sells. Costs are the first place to look.",
        pt: "Em média, o negócio tem gastado mais do que vende. Os custos são o primeiro lugar para olhar.",
      }),
    });
  } else if (f.household_share_bps !== null && f.household_share_bps > 8000) {
    const p = pct(f.household_share_bps);
    out.push({
      tone: "watch",
      text: tr({
        en: `About ${p}% of what the business makes goes to the household. Leaving a little more in the business builds a cushion for slow months.`,
        pt: `Cerca de ${p}% do que o negócio ganha vai para as despesas da casa. Deixar um pouco mais no negócio cria uma reserva para os meses fracos.`,
      }),
    });
  } else if (f.household_share_bps !== null) {
    const kept = 100 - pct(f.household_share_bps);
    out.push({
      tone: "good",
      text: tr({
        en: `The business keeps about ${kept}% of what it makes after household expenses.`,
        pt: `O negócio fica com cerca de ${kept}% do que ganha depois das despesas da casa.`,
      }),
    });
  }

  if (f.revenue_cv_bps !== null && f.revenue_cv_bps > 5000) {
    out.push({
      tone: "watch",
      text: tr({
        en: "Sales swing a lot from month to month. A small reserve helps through the low months.",
        pt: "As vendas oscilam muito de um mês para outro. Uma pequena reserva ajuda nos meses fracos.",
      }),
    });
  }

  if (f.consecutive_months >= 6) {
    out.push({
      tone: "good",
      text: tr({
        en: "Six months reported in a row: that record is what makes the business legible.",
        pt: "Seis meses informados seguidos: é esse histórico que permite entender o negócio.",
      }),
    });
  } else if (f.months_since_last !== null && f.months_since_last > 1) {
    out.push({
      tone: "watch",
      text: tr({
        en: `The last check-in was ${f.months_since_last} months ago. Reporting this month restarts the record.`,
        pt: `O último check-in foi há ${f.months_since_last} meses. Informar este mês retoma o histórico.`,
      }),
    });
  }

  return out;
}
