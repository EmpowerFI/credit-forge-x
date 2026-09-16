import type { PoolCheck, RiskBand } from "@empowerfi/capital-allocation";
import { localized, tr } from "../../../i18n";
import { bpsPercent } from "../../../lib/capital";
import { AFFORDABILITY_LIMIT_BPS, type CreditStepId, type EngineOpportunity, READINESS_THRESHOLDS } from "../../../lib/engine";
import { money, PURPOSE_LABEL } from "../../../lib/readiness";

export type NodeState = "waiting" | "evaluating" | "passed" | "failed" | "skipped";

/** A step's state at a tick: waiting before its turn, evaluating on it, settled after. */
export const nodeState = (index: number, tick: number, passed: boolean, stoppedBefore = false): NodeState =>
  stoppedBefore ? "skipped" : tick < index ? "waiting" : tick === index ? "evaluating" : passed ? "passed" : "failed";

export const bandLetter = (b: RiskBand | null | undefined) => (b === "LOW" ? "A" : b === "MEDIUM" ? "B" : b === "HIGH" ? "C" : "—");

// ------------------------------------------------------------------ labels

export const CREDIT_STEP_TITLE: Record<CreditStepId, string> = localized({
  business_data: { en: "Business data", pt: "Dados do negócio" },
  preparation: { en: "Education and preparation", pt: "Formação e preparo" },
  readiness: { en: "Readiness", pt: "Prontidão" },
  affordability: { en: "Affordability", pt: "Capacidade de pagamento" },
  risk: { en: "Risk assessment", pt: "Avaliação de risco" },
  eligibility: { en: "Eligibility", pt: "Elegibilidade" },
});

/** What each credit step read, in one line, from the recorded assessments. */
export function creditDetail(id: CreditStepId, o: EngineOpportunity): string {
  const r = o.readiness;
  const e = o.eligibility;
  switch (id) {
    case "business_data":
      return tr({
        en: `${r.months_reported ?? 0} months reported, ${r.consecutive_months ?? 0} in a row${r.records_kept_bps !== null ? ` · ${bpsPercent(r.records_kept_bps)} fully recorded` : ""} · needs ${READINESS_THRESHOLDS.MIN_MONTHS_REPORTED}+`,
        pt: `${r.months_reported ?? 0} meses informados, ${r.consecutive_months ?? 0} seguidos${r.records_kept_bps !== null ? ` · ${bpsPercent(r.records_kept_bps)} registrados por completo` : ""} · mínimo ${READINESS_THRESHOLDS.MIN_MONTHS_REPORTED}`,
      });
    case "preparation":
      return tr({
        en: `${r.core_modules_completed ?? 0} of ${r.core_modules_total ?? 0} core modules · community ${r.community_verified ? "verified" : "not verified"}`,
        pt: `${r.core_modules_completed ?? 0} de ${r.core_modules_total ?? 0} módulos essenciais · comunidade ${r.community_verified ? "verificada" : "não verificada"}`,
      });
    case "readiness":
      return tr({
        en: `Score ${r.score} · ${r.status} · ${r.model_version}`,
        pt: `Nota ${r.score} · ${r.status} · ${r.model_version}`,
      });
    case "affordability":
      return e.affordability_bps === null
        ? tr({ en: "Not recorded", pt: "Não registrada" })
        : tr({
          en: `Instalment ${bpsPercent(e.affordability_bps)} of her monthly result · limit ${bpsPercent(AFFORDABILITY_LIMIT_BPS)}`,
          pt: `Parcela de ${bpsPercent(e.affordability_bps)} do resultado mensal dela · limite ${bpsPercent(AFFORDABILITY_LIMIT_BPS)}`,
        });
    case "risk":
      return tr({
        en: `Risk band ${bandLetter(e.risk_band ?? o.risk_band)} · confidence ${(e.confidence ?? o.confidence ?? "—").toString().toLowerCase()}`,
        pt: `Faixa de risco ${bandLetter(e.risk_band ?? o.risk_band)} · confiança ${({ LOW: "baixa", MEDIUM: "média", HIGH: "alta" } as Record<string, string>)[e.confidence ?? o.confidence ?? ""] ?? "—"}`,
      });
    case "eligibility":
      if (o.status === "in_review") return tr({ en: `${e.decision} · held for a person to review`, pt: `${e.decision} · aguardando revisão de uma pessoa` });
      return e.requested_cents && e.proposed_cents && e.proposed_cents < e.requested_cents
        ? tr({ en: `${e.decision} · ${money(e.proposed_cents)} of ${money(e.requested_cents)} asked`, pt: `${e.decision} · ${money(e.proposed_cents)} dos ${money(e.requested_cents)} pedidos` })
        : tr({ en: `${e.decision} · ${e.model_version}`, pt: `${e.decision} · ${e.model_version}` });
  }
}

export const CHECK_TITLE: Record<PoolCheck["check"], string> = localized({
  liquidity: { en: "Liquidity", pt: "Liquidez" },
  ticket: { en: "Ticket policy", pt: "Política de ticket" },
  risk_appetite: { en: "Risk appetite", pt: "Apetite a risco" },
  mandate: { en: "Productive-purpose mandate", pt: "Mandato de finalidade produtiva" },
});

/** What a pool check compared, in words. */
export function checkDetail(c: PoolCheck): string {
  switch (c.check) {
    case "liquidity":
      return tr({ en: `${money(c.value as number)} needed · ${money(c.limit as number)} available`, pt: `${money(c.value as number)} necessários · ${money(c.limit as number)} disponíveis` });
    case "ticket": {
      const [min, max] = c.limit as [number, number];
      return tr({ en: `${money(c.value as number)} requested · policy ${money(min)} to ${money(max)}`, pt: `${money(c.value as number)} pedidos · política de ${money(min)} a ${money(max)}` });
    }
    case "risk_appetite":
      return tr({
        en: `Band ${bandLetter(c.value as RiskBand)} · accepts ${(c.limit as string[]).map((b) => bandLetter(b as RiskBand)).join(", ") || "none"}`,
        pt: `Faixa ${bandLetter(c.value as RiskBand)} · aceita ${(c.limit as string[]).map((b) => bandLetter(b as RiskBand)).join(", ") || "nenhuma"}`,
      });
    case "mandate": {
      const purposes = c.limit as string[];
      const label = PURPOSE_LABEL[c.value as keyof typeof PURPOSE_LABEL] ?? String(c.value);
      return purposes.length === 0
        ? tr({ en: `${label} · any productive purpose`, pt: `${label} · qualquer finalidade produtiva` })
        : tr({ en: `${label} · funds ${purposes.map((p) => PURPOSE_LABEL[p as keyof typeof PURPOSE_LABEL] ?? p).join(", ")}`, pt: `${label} · financia ${purposes.map((p) => PURPOSE_LABEL[p as keyof typeof PURPOSE_LABEL] ?? p).join(", ")}` });
    }
  }
}
