import { Link } from "react-router-dom";
import Panel from "../../components/product/Panel";
import ProofLine from "../../components/product/ProofLine";
import StatTile from "../../components/product/StatTile";
import { CAPITAL_USE_LABEL } from "../../lib/credit";
import { RISK, type Grade } from "../../lib/investor";
import { LIVE_LOAN, outstandingCents, rate, stageOf } from "../../lib/partner";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import { useDesk } from "./context";
import { StagePill } from "./parts";

const BANDS: Grade[] = ["LOW", "MEDIUM", "HIGH"];

/** The partner's book: what is lent, what came back, where the capital came from, and what it did for the business. */
export default function Portfolio() {
  const { desk } = useDesk();
  const oppOf = new Map(desk.opportunities.map((o) => [o.opportunity_id, o]));
  const book = desk.loans.filter((l) => LIVE_LOAN.includes(l.status));
  const lent = book.reduce((n, l) => n + l.principal_cents, 0);
  const outstanding = book.reduce((n, l) => n + outstandingCents(l), 0);
  const received = book.reduce((n, l) => n + l.received_cents, 0);
  const defaulted = book.filter((l) => l.status === "DEFAULTED");
  // Funded by investors: the whole principal when the opportunity was funded; her choice not to list it means the partner's own.
  const byInvestors = book.filter((l) => l.funding.status === "funded").reduce((n, l) => n + l.principal_cents, 0);
  const outcomes = book.filter((l) => l.outcome);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Lent" value={money(lent)} hint={`${book.length} loans`} />
        <StatTile label="Outstanding" value={money(outstanding)} hint="principal" hintTone="info" />
        <StatTile label="Received" value={money(received)} hint="instalments" hintTone="positive" />
        <StatTile label="Funded by investors" value={lent ? `${Math.round((byInvestors / lent) * 100)}%` : "—"} hint={money(byInvestors)} />
        <StatTile label="Your own capital" value={money(lent - byInvestors)} hint="not offered to investors" />
        <StatTile label="Defaulted" value={defaulted.length} hint={money(defaulted.reduce((n, l) => n + outstandingCents({ ...l, status: "ACTIVE" }), 0))}
          hintTone={defaulted.length ? "alert" : "neutral"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="By risk band" description="Principal lent, by the band EmpowerFI's eligibility rules gave each request.">
          <ul className="space-y-3">
            {BANDS.map((b) => {
              const sum = book.filter((l) => l.risk_band === b).reduce((n, l) => n + l.principal_cents, 0);
              const share = lent ? Math.round((sum / lent) * 100) : 0;
              return (
                <li key={b} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{RISK[b].label}</span>
                    <span className="num text-muted-foreground">{money(sum)} · {share}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${RISK[b].bar}`} style={{ width: `${share}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="What the capital did" description="Measured from her own reported months before and after the loan: sales, and the value the credit created after its cost (EVC). Proven on Solana.">
          {outcomes.length === 0 ? <p className="text-sm text-muted-foreground">Outcomes are measured once a loan has two reported months on each side.</p> : (
            <ul className="divide-y divide-border">
              {outcomes.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                    <span className="block text-xs text-muted-foreground">
                      Sales {money(l.outcome!.avg_revenue_before_cents)} → {money(l.outcome!.avg_revenue_after_cents)} a month · {CAPITAL_USE_LABEL[l.outcome!.capital_use]}
                    </span>
                  </span>
                  <span className={`num text-sm font-semibold ${l.outcome!.evc_cents >= 0 ? "text-positive" : "text-alert"}`}>EVC {money(l.outcome!.evc_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Loans" description="Every loan you lent or approved. Open one for its schedule, where the money went, and each step's proof.">
        {desk.loans.length === 0 ? <p className="text-sm text-muted-foreground">No loans yet.</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Loan</th>
                  <th className="py-2 pr-4 text-right font-medium">Principal</th>
                  <th className="py-2 pr-4 font-medium">Terms</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Paid</th>
                  <th className="py-2 pr-4 text-right font-medium">Outstanding</th>
                  <th className="py-2 pr-4 font-medium">Capital</th>
                  <th className="py-2 font-medium">Terms on chain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {desk.loans.map((l) => {
                  const o = oppOf.get(l.opportunity_id);
                  return (
                    <tr key={l.id} className="align-top">
                      <td className="py-3 pr-4">
                        <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                        <span className="block text-xs text-muted-foreground">{PURPOSE_LABEL[l.purpose]} · {l.business_sector ?? "—"}</span>
                      </td>
                      <td className="num py-3 pr-4 text-right text-foreground">{money(l.principal_cents)}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{l.term_months} × {money(l.instalment_cents)}<span className="block">{rate(l.rate_bps)}</span></td>
                      <td className="py-3 pr-4">{o ? <StagePill stage={stageOf(o, l)} /> : null}</td>
                      <td className="num py-3 pr-4 text-right text-foreground">{l.paid}/{l.term_months}<span className="block text-xs text-muted-foreground">{money(l.received_cents)}</span></td>
                      <td className="num py-3 pr-4 text-right text-foreground">{money(outstandingCents(l))}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {l.funding.status === "funded" ? `Investors (${l.funding.investors})` : l.funding.status === null ? "Your own" : l.funding.status === "refunded" ? "Refunded" : "Raising"}
                      </td>
                      <td className="py-3 text-xs"><ProofLine proof={l.proof} /></td>
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
