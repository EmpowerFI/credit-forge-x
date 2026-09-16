import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DataTag } from "../../components/product/DataLegend";
import Panel from "../../components/product/Panel";
import ProofLine from "../../components/product/ProofLine";
import StatusPill from "../../components/product/StatusPill";
import { tr } from "../../i18n";
import { shortDate } from "../../lib/community";
import { DECISION_LABEL, ELIGIBILITY_REASON, percent } from "../../lib/credit";
import { RISK } from "../../lib/investor";
import { money, PURPOSE_LABEL, sectorLabel } from "../../lib/readiness";
import { useDesk } from "./context";
import { FundingSummary, OpportunityActions, StagePill } from "./parts";
import { level, stageOf } from "../../lib/partner";

const TONE_OF: Record<string, "positive" | "info" | "neutral" | "caution"> = {
  "tone-positive": "positive", "tone-info": "info", "tone-neutral": "neutral", "tone-caution": "caution",
};

function Fact({ label, children, kind = "derived" }: { label: string; children: React.ReactNode; kind?: "derived" | "private" }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground"><DataTag kind={kind} /> {label}</dt>
      <dd className="num mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Each qualified opportunity before a loan exists: what EmpowerFI's rules
 * found, the pool the allocation engine chose, and how far investors have
 * funded it. Funded, the desk formalises it at the engine's rate.
 */
export default function Reviews() {
  const { desk, decides } = useDesk();
  const { hash } = useLocation();
  const waiting = desk.opportunities.filter((o) => o.status === "referred");

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  if (waiting.length === 0) {
    return (
      <Panel title={tr({ en: "Nothing before formalisation", pt: "Nada antes da formalização" })}>
        <p className="text-sm text-muted-foreground">
          {tr({
            en: "Every qualified opportunity has been formalised or declined. New ones arrive here as EmpowerFI's rules qualify them.",
            pt: "Toda oportunidade qualificada já foi formalizada ou recusada. As novas chegam aqui quando as regras da EmpowerFI as qualificam.",
          })}
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        {tr({
          en: "What you see is derived by EmpowerFI's engines from what she reported, rounded where it would otherwise be her books. Her name, her business's name and her monthly figures stay private. There is no separate approval: once investors have funded an opportunity, the desk formalises it at the rate the Capital Allocation Engine set, and disburses. The desk can decline, and investors are refunded.",
          pt: "O que você vê é derivado pelos motores da EmpowerFI a partir do que ela reportou, arredondado onde, de outro modo, seriam as contas dela. O nome dela, o nome do negócio e os números mensais ficam privados. Não há uma aprovação à parte: quando a oportunidade está 100% captada, a mesa a formaliza com a taxa definida pelo Motor de Alocação de Capital e desembolsa. A mesa pode recusar, e os investidores são reembolsados.",
        })}
      </p>
      <ul className="space-y-4">
        {waiting.map((o) => {
          const d = DECISION_LABEL[o.eligibility_decision];
          return (
            <li key={o.opportunity_id} id={o.opportunity_id} className="scroll-mt-24">
              <Panel
                title={<span className="font-mono">{o.participant}</span>}
                description={`${PURPOSE_LABEL[o.purpose]} · ${sectorLabel(o.business_sector) ?? "—"} · ${o.community_name ?? "—"} (${o.community_city}, ${o.community_state}) · ${
                  tr({ en: `qualified ${shortDate(o.referred_at)}`, pt: `qualificada em ${shortDate(o.referred_at)}` })}`}
                actions={<span className="flex flex-wrap gap-2"><StagePill stage={stageOf(o)} /><StatusPill tone={TONE_OF[d.tone] ?? "neutral"}>{tr({ en: "Eligibility", pt: "Elegibilidade" })}: {d.title}</StatusPill></span>}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <Fact label={o.requested_amount_cents !== o.amount_cents ? tr({ en: "Proposed (asked)", pt: "Proposto (pedido)" }) : tr({ en: "Request", pt: "Pedido" })}>
                    {money(o.amount_cents)}
                    {o.requested_amount_cents !== o.amount_cents && <span className="text-xs text-muted-foreground"> ({money(o.requested_amount_cents)})</span>}
                  </Fact>
                  <Fact label={tr({ en: "Sized at", pt: "Dimensionado em" })}>{o.term_months} × {money(o.instalment_cents)}</Fact>
                  <Fact label={tr({ en: "Instalment / monthly result", pt: "Parcela / resultado mensal" })}>{percent(o.affordability_bps)}</Fact>
                  <Fact label={tr({ en: "Risk · confidence", pt: "Risco · confiança" })}>{RISK[o.risk_band].label} · {level(o.confidence, "f")}</Fact>
                  <Fact label={tr({ en: "Avg sales / result, rounded", pt: "Vendas / resultado médios, arredondados" })}>{money(o.avg_revenue_cents)} / {money(o.avg_net_business_cents)}</Fact>
                  <Fact label={tr({ en: "History", pt: "Histórico" })}>
                    {tr({
                      en: `${o.months_reported ?? "—"} months · readiness ${level(o.readiness_band)}`,
                      pt: `${o.months_reported ?? "—"} meses · prontidão ${level(o.readiness_band, "f")}`,
                    })}
                  </Fact>
                  <Fact label={tr({ en: "Suggested range", pt: "Faixa sugerida" })}>{money(o.suggested_min_cents)} – {money(o.suggested_max_cents)}</Fact>
                  <Fact label={tr({ en: "Sales variation", pt: "Variação das vendas" })}>{percent(o.revenue_cv_bps)}</Fact>
                </dl>
                <ul className="flex flex-wrap gap-2">
                  {o.eligibility_reasons.map((r) => (
                    <li key={r} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{ELIGIBILITY_REASON[r] ?? r}</li>
                  ))}
                </ul>
                <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{tr({ en: "Funding route and investors", pt: "Rota de captação e investidores" })}</p>
                    <FundingSummary funding={o.funding} amountCents={o.amount_cents} />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-medium text-muted-foreground">{tr({ en: "Evidence", pt: "Evidências" })}</p>
                    <p className="text-muted-foreground">
                      {tr({ en: `Models ${o.readiness_model} and ${o.eligibility_model}`, pt: `Modelos ${o.readiness_model} e ${o.eligibility_model}` })}
                    </p>
                    <ProofLine proof={o.proof} />
                  </div>
                </div>
                {decides && <div className="border-t border-border pt-4"><OpportunityActions o={o} decides={decides} /></div>}
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
