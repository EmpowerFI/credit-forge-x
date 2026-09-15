import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import { shortDate } from "../../lib/community";
import { STAGE, outstandingCents, stageOf, type DeskStage } from "../../lib/partner";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import { useDesk } from "./context";
import { FundingSummary, LoanActions, StagePill } from "./parts";

const ORDER: DeskStage[] = ["deciding", "to_formalise", "overdue", "disbursed", "raising", "repaying", "defaulted", "paid", "cancelled", "declined", "withdrawn"];

/**
 * Every request referred to the partner, where it stands, and what the
 * partner has to do next: decide, formalise once funded, start repayment,
 * follow up an overdue instalment.
 */
export default function Pipeline() {
  const { desk, decides } = useDesk();
  const loanOf = new Map(desk.loans.map((l) => [l.opportunity_id, l]));
  const rows = desk.opportunities
    .map((o) => ({ o, loan: loanOf.get(o.opportunity_id), stage: stageOf(o, loanOf.get(o.opportunity_id)) }))
    .sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) || b.o.referred_at.localeCompare(a.o.referred_at));
  const count = (s: DeskStage) => rows.filter((r) => r.stage === s).length;
  const deciding = rows.filter((r) => r.stage === "deciding");
  const live = desk.loans.filter((l) => l.status === "ACTIVE" || l.status === "DISBURSED");
  const actions = rows.filter((r) => ["deciding", "to_formalise", "disbursed", "overdue"].includes(r.stage));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Awaiting your decision" value={deciding.length} hint={money(deciding.reduce((n, r) => n + r.o.amount_cents, 0))} hintTone="info" />
        <StatTile label="Investors funding" value={count("raising")} hint="approved, raising" />
        <StatTile label="Ready to formalise" value={count("to_formalise")} hint="funded" hintTone={count("to_formalise") ? "positive" : "neutral"} />
        <StatTile label="Repaying" value={count("repaying") + count("overdue") + count("disbursed")}
          hint={`${money(live.reduce((n, l) => n + outstandingCents(l), 0))} outstanding`} />
        <StatTile label="Overdue" value={count("overdue")} hint={`${desk.loans.reduce((n, l) => n + l.overdue, 0)} instalments`}
          hintTone={count("overdue") ? "alert" : "neutral"} />
        <StatTile label="Received" value={money(desk.loans.reduce((n, l) => n + l.received_cents, 0))} hint="instalments" hintTone="positive" />
      </div>

      <Panel title="Your next actions" description={decides ? "What waits on you, most urgent first." : "What waits on the partner, most urgent first."}>
        {actions.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waits on you right now.</p> : (
          <ul className="divide-y divide-border">
            {actions.map(({ o, loan, stage }) => (
              <li key={o.opportunity_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-foreground">{o.participant}</span>
                    <StagePill stage={stage} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {money(loan?.principal_cents ?? o.amount_cents)} · {PURPOSE_LABEL[o.purpose].toLowerCase()} · {o.business_sector ?? "—"}
                    {stage === "overdue" && loan && ` · ${loan.overdue} overdue since ${shortDate(loan.next_due_at)}`}
                  </p>
                </div>
                {stage === "deciding" ? (
                  <Link to={`reviews#${o.opportunity_id}`} className="inline-flex items-center gap-1 text-sm text-info hover:underline">
                    {STAGE[stage].next} <ArrowRight size={14} />
                  </Link>
                ) : stage === "overdue" && loan ? (
                  <Link to={`loans/${loan.id}`} className="inline-flex items-center gap-1 text-sm text-info hover:underline">
                    Open the schedule <ArrowRight size={14} />
                  </Link>
                ) : loan && (decides ? <LoanActions loan={loan} decides={decides} /> : <span className="text-xs text-muted-foreground">{STAGE[stage].next}</span>)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Every request" description="Referred to you by EmpowerFI after its eligibility rules, and funded by investors when she allowed it to be shown to them.">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing has been referred to you yet.</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Participant</th>
                  <th className="py-2 pr-4 font-medium">Request</th>
                  <th className="py-2 pr-4 text-right font-medium">Amount</th>
                  <th className="w-56 py-2 pr-4 font-medium">Funding</th>
                  <th className="py-2 pr-4 font-medium">Stage</th>
                  <th className="py-2 font-medium">Referred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ o, loan, stage }) => (
                  <tr key={o.opportunity_id} className="align-top">
                    <td className="py-3 pr-4">
                      {loan ? (
                        <Link to={`loans/${loan.id}`} className="font-mono text-foreground hover:underline">{o.participant}</Link>
                      ) : <span className="font-mono text-foreground">{o.participant}</span>}
                      <span className="block text-xs text-muted-foreground">{o.community_name ?? "—"}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-foreground">{PURPOSE_LABEL[o.purpose]}</span>
                      <span className="block text-xs text-muted-foreground">{o.business_sector ?? "—"} · risk {o.risk_band.toLowerCase()}</span>
                    </td>
                    <td className="num py-3 pr-4 text-right text-foreground">
                      {money(loan?.principal_cents ?? o.amount_cents)}
                      <span className="block text-xs text-muted-foreground">{loan?.term_months ?? o.term_months} months</span>
                    </td>
                    <td className="py-3 pr-4"><FundingSummary funding={o.funding} compact /></td>
                    <td className="py-3 pr-4"><StagePill stage={stage} /></td>
                    <td className="py-3 text-xs text-muted-foreground">{shortDate(o.referred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
