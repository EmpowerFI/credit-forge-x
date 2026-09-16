import { Link } from "react-router-dom";
import Panel from "../../components/product/Panel";
import ProofLine from "../../components/product/ProofLine";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { shortDate } from "../../lib/community";
import { rate, stageOf } from "../../lib/partner";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import { useDesk } from "./context";
import { StagePill } from "./parts";

/**
 * The desk's decisions, as a record: each formalisation at the allocation
 * engine's rate, each decline with its reason, and what followed. A loan's
 * terms are proven on Solana; a decline returns investors' capital.
 */
export default function Decisions() {
  const { desk } = useDesk();
  const loanOf = new Map(desk.loans.map((l) => [l.opportunity_id, l]));
  const decided = desk.opportunities.filter((o) => o.decision)
    .sort((a, b) => b.decision!.decided_at.localeCompare(a.decision!.decided_at));
  const approved = decided.filter((o) => o.decision!.verdict === "approved");
  const declined = decided.filter((o) => o.decision!.verdict === "declined");
  const cancelled = desk.loans.filter((l) => l.status === "CANCELLED");
  const avgRate = approved.length ? approved.reduce((n, o) => n + (o.decision!.rate_bps ?? 0), 0) / approved.length : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Formalised" value={approved.length} hint={money(approved.reduce((n, o) => n + (o.decision!.approved_amount_cents ?? 0), 0))} hintTone="positive" />
        <StatTile label="Declined" value={declined.length} hint="before a loan" />
        <StatTile label="Declined at formalisation" value={cancelled.length} hint="investors refunded" />
        <StatTile label="Average rate" value={avgRate === null ? "—" : `${(avgRate / 100).toFixed(2)}%`} hint="a month, set by the engine" />
      </div>

      <Panel title="Decision record" description="Every formalisation and decline, newest first. A loan's terms are proven on Solana; its rate is the Capital Allocation Engine's, set when the opportunity was given its pool.">
        {decided.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Decided</th>
                  <th className="py-2 pr-4 font-medium">Participant</th>
                  <th className="py-2 pr-4 font-medium">Verdict</th>
                  <th className="py-2 pr-4 text-right font-medium">Terms</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 pr-4 font-medium">Since</th>
                  <th className="py-2 font-medium">Proof of the terms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {decided.map((o) => {
                  const d = o.decision!;
                  const loan = loanOf.get(o.opportunity_id);
                  return (
                    <tr key={o.opportunity_id} className="align-top">
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {shortDate(d.decided_at)}
                        {d.decided_by && <span className="block">{d.decided_by}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {loan ? <Link to={`../loans/${loan.id}`} relative="path" className="font-mono text-foreground hover:underline">{o.participant}</Link>
                          : <span className="font-mono text-foreground">{o.participant}</span>}
                        <span className="block text-xs text-muted-foreground">{PURPOSE_LABEL[o.purpose]} · {money(o.amount_cents)} qualified</span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill tone={d.verdict === "approved" ? "positive" : "neutral"}>{d.verdict === "approved" ? "Formalised" : "Declined"}</StatusPill>
                      </td>
                      <td className="num py-3 pr-4 text-right text-foreground">
                        {d.verdict === "approved" ? (
                          <>
                            {money(d.approved_amount_cents)}
                            <span className="block text-xs text-muted-foreground">{d.term_months} months · {rate(d.rate_bps)}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="max-w-[16rem] py-3 pr-4 text-xs text-muted-foreground">{d.reason ?? "—"}</td>
                      <td className="py-3 pr-4"><StagePill stage={stageOf(o, loan)} /></td>
                      <td className="py-3 text-xs">{loan ? <ProofLine proof={loan.proof} /> : <span className="text-muted-foreground">No loan: nothing to prove</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
