import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { shortDate } from "../../lib/community";
import { isRaising, stageOf } from "../../lib/partner";
import { money } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { useDesk } from "./context";
import { FundingSummary, LoanActions, StagePill } from "./parts";

const DAY = 86_400_000;

/**
 * The partner's servicing: loans to formalise once funded, repayments to
 * record, what is overdue, and each instalment's way back to investors.
 */
export default function Servicing() {
  const { desk, decides } = useDesk();
  const oppOf = new Map(desk.opportunities.map((o) => [o.opportunity_id, o]));
  const approved = desk.loans.filter((l) => l.status === "PARTNER_APPROVED");
  const repaying = desk.loans.filter((l) => l.status === "ACTIVE" || l.status === "DISBURSED")
    .sort((a, b) => b.overdue - a.overdue || (a.next_due_at ?? "9").localeCompare(b.next_due_at ?? "9"));
  const now = Date.now();
  const instalments = repaying.flatMap((l) => l.schedule.map((s) => ({ l, s })));
  const upcoming = instalments
    .filter(({ s }) => !s.payment_id && s.due_at && new Date(s.due_at).getTime() < now + 45 * DAY)
    .sort((a, b) => a.s.due_at!.localeCompare(b.s.due_at!));
  const overdue = instalments.filter(({ s }) => !s.payment_id && s.late);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const collected = desk.loans.flatMap((l) => l.schedule).filter((s) => s.paid_at && new Date(s.paid_at).getTime() >= monthStart);
  const back = desk.loans.flatMap((l) => l.schedule).reduce(
    (acc, s) => ({ done: acc.done + (s.to_investors.done > 0 ? s.to_investors.amount_micro_usdc : 0), held: acc.held + s.to_investors.held }),
    { done: 0, held: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Due in the next 45 days" value={upcoming.filter(({ s }) => !s.late).length}
          hint={money(upcoming.filter(({ s }) => !s.late).reduce((n, { s }) => n + s.amount_cents, 0))} />
        <StatTile label="Overdue instalments" value={overdue.length} hint={money(overdue.reduce((n, { s }) => n + s.amount_cents, 0))}
          hintTone={overdue.length ? "alert" : "neutral"} />
        <StatTile label="Collected this month" value={money(collected.reduce((n, s) => n + s.amount_cents, 0))} hint={`${collected.length} instalments`} hintTone="positive" />
        <StatTile label="Back to investors" value={usdc(back.done)} hint={back.held ? `${back.held} shares held` : "real devnet USDC"} />
      </div>

      <Panel title="To formalise" description="Approved by you. You sign and disburse once investors have funded it; if you decline now, they are refunded.">
        {approved.length === 0 ? <p className="text-sm text-muted-foreground">No approved loan waits to be formalised.</p> : (
          <ul className="divide-y divide-border">
            {approved.map((l) => {
              const o = oppOf.get(l.opportunity_id);
              return (
                <li key={l.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                    <p className="text-xs text-muted-foreground">{money(l.principal_cents)} · {l.term_months} × {money(l.instalment_cents)} · approved {shortDate(l.created_at)}</p>
                    {o && <div className="mt-1"><StagePill stage={stageOf(o, l)} /></div>}
                  </div>
                  <FundingSummary funding={l.funding} />
                  <div className="md:justify-self-end">
                    {decides ? <LoanActions loan={l} decides /> : (
                      <span className="text-xs text-muted-foreground">{isRaising(l.funding) ? "Waiting for investors" : "Ready to disburse"}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Repayments" description="Instalments fall due a month apart from when repayment starts. Each one recorded is proven on Solana, paid by her through Pix (a mock here), and its investors' shares go back to them.">
        {repaying.length === 0 ? <p className="text-sm text-muted-foreground">No loan is repaying.</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Loan</th>
                  <th className="py-2 pr-4 font-medium">Next due</th>
                  <th className="py-2 pr-4 text-right font-medium">Paid</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">{decides ? "Record" : "Next step"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {repaying.map((l) => {
                  const o = oppOf.get(l.opportunity_id);
                  return (
                    <tr key={l.id} className="align-top">
                      <td className="py-3 pr-4">
                        <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                        <span className="block text-xs text-muted-foreground">{l.term_months} × {money(l.instalment_cents)}</span>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        {l.next_due_at ? <span className={l.overdue ? "text-alert" : "text-foreground"}>{shortDate(l.next_due_at)}</span>
                          : <span className="text-muted-foreground">{l.status === "DISBURSED" ? "Starts with repayment" : "—"}</span>}
                        {l.overdue > 0 && (
                          <span className="mt-0.5 flex items-center gap-1 text-alert"><AlertTriangle size={12} aria-hidden /> {l.overdue} overdue</span>
                        )}
                      </td>
                      <td className="num py-3 pr-4 text-right text-foreground">{l.paid}/{l.term_months}<span className="block text-xs text-muted-foreground">{money(l.received_cents)}</span></td>
                      <td className="py-3 pr-4">{o && <StagePill stage={stageOf(o, l)} />}</td>
                      <td className="py-3">{decides ? <LoanActions loan={l} decides /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Calendar" description="Unpaid instalments due in the next 45 days, and every one already late.">
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing falls due in the next 45 days.</p> : (
          <ul className="divide-y divide-border">
            {upcoming.map(({ l, s }) => (
              <li key={`${l.id}-${s.instalment_no}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`num w-24 shrink-0 text-xs ${s.late ? "text-alert" : "text-muted-foreground"}`}>{shortDate(s.due_at)}</span>
                  <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                  <span className="text-xs text-muted-foreground">instalment {s.instalment_no} of {l.term_months}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="num text-foreground">{money(s.amount_cents)}</span>
                  <StatusPill tone={s.late ? "alert" : "info"}>{s.late ? "Late" : "Due"}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
