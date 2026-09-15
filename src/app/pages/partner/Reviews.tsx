import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DataTag } from "../../components/product/DataLegend";
import Panel from "../../components/product/Panel";
import ProofLine from "../../components/product/ProofLine";
import StatusPill from "../../components/product/StatusPill";
import { shortDate } from "../../lib/community";
import { DECISION_LABEL, ELIGIBILITY_REASON, percent } from "../../lib/credit";
import { RISK } from "../../lib/investor";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import { useDesk } from "./context";
import { DecisionForm, FundingSummary } from "./parts";

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
 * Each request waiting on the partner, with what EmpowerFI's rules found and
 * how far investors have funded it. The decision is the partner's alone.
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
      <Panel title="Nothing waiting">
        <p className="text-sm text-muted-foreground">Every request referred to you has a decision. New ones arrive here as EmpowerFI's rules qualify them.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        What you see is derived by EmpowerFI's engines from what she reported, rounded where it would otherwise be her books. Her name, her
        business's name and her monthly figures stay private. Investors may already be funding a request: approving it does not disburse, and
        you formalise once it is funded.
      </p>
      <ul className="space-y-4">
        {waiting.map((o) => {
          const d = DECISION_LABEL[o.eligibility_decision];
          return (
            <li key={o.opportunity_id} id={o.opportunity_id} className="scroll-mt-24">
              <Panel
                title={<span className="font-mono">{o.participant}</span>}
                description={`${PURPOSE_LABEL[o.purpose]} · ${o.business_sector ?? "—"} · ${o.community_name ?? "—"} (${o.community_city}, ${o.community_state}) · referred ${shortDate(o.referred_at)}`}
                actions={<StatusPill tone={TONE_OF[d.tone] ?? "neutral"}>EmpowerFI: {d.title}</StatusPill>}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <Fact label={o.requested_amount_cents !== o.amount_cents ? "Proposed (asked)" : "Request"}>
                    {money(o.amount_cents)}
                    {o.requested_amount_cents !== o.amount_cents && <span className="text-xs text-muted-foreground"> ({money(o.requested_amount_cents)})</span>}
                  </Fact>
                  <Fact label="Sized at">{o.term_months} × {money(o.instalment_cents)}</Fact>
                  <Fact label="Instalment / monthly result">{percent(o.affordability_bps)}</Fact>
                  <Fact label="Risk · confidence">{RISK[o.risk_band].label} · {o.confidence.toLowerCase()}</Fact>
                  <Fact label="Avg sales / result, rounded">{money(o.avg_revenue_cents)} / {money(o.avg_net_business_cents)}</Fact>
                  <Fact label="History">{o.months_reported ?? "—"} months · readiness {o.readiness_band.toLowerCase()}</Fact>
                  <Fact label="Suggested range">{money(o.suggested_min_cents)} – {money(o.suggested_max_cents)}</Fact>
                  <Fact label="Sales variation">{percent(o.revenue_cv_bps)}</Fact>
                </dl>
                <ul className="flex flex-wrap gap-2">
                  {o.eligibility_reasons.map((r) => (
                    <li key={r} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{ELIGIBILITY_REASON[r] ?? r}</li>
                  ))}
                </ul>
                <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Investor funding</p>
                    <FundingSummary funding={o.funding} />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-medium text-muted-foreground">Evidence</p>
                    <p className="text-muted-foreground">Models {o.readiness_model} and {o.eligibility_model}</p>
                    <ProofLine proof={o.proof} />
                  </div>
                </div>
                {decides && <DecisionForm o={o} />}
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
