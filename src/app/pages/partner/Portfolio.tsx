import { Link } from "react-router-dom";
import Panel from "../../components/product/Panel";
import ProofLine from "../../components/product/ProofLine";
import StatTile from "../../components/product/StatTile";
import { tr } from "../../i18n";
import { CAPITAL_USE_LABEL } from "../../lib/credit";
import { RISK, type Grade } from "../../lib/investor";
import { LIVE_LOAN, outstandingCents, rate, stageOf } from "../../lib/partner";
import { money, PURPOSE_LABEL, sectorLabel } from "../../lib/readiness";
import { useDesk } from "./context";
import { StagePill } from "./parts";
import EvcLabel from "../../components/product/EvcLabel";

const BANDS: Grade[] = ["LOW", "MEDIUM", "HIGH"];

/** The desk's book: what is lent, what came back, which pool the capital came from, and what it did for the business. */
export default function Portfolio() {
  const { desk } = useDesk();
  const oppOf = new Map(desk.opportunities.map((o) => [o.opportunity_id, o]));
  const book = desk.loans.filter((l) => LIVE_LOAN.includes(l.status));
  const lent = book.reduce((n, l) => n + l.principal_cents, 0);
  const outstanding = book.reduce((n, l) => n + outstandingCents(l), 0);
  const received = book.reduce((n, l) => n + l.received_cents, 0);
  const defaulted = book.filter((l) => l.status === "DEFAULTED");
  // Funded by investors: the whole principal, from the pool the allocation engine chose.
  const byPool = (pool: "domestic" | "global") => book.filter((l) => l.funding.pool === pool).reduce((n, l) => n + l.principal_cents, 0);
  const outcomes = book.filter((l) => l.outcome);
  const shareOfLent = (pool: "domestic" | "global") => {
    if (!lent) return undefined;
    const share = Math.round((byPool(pool) / lent) * 100);
    return tr({ en: `${share}% of lent`, pt: `${share}% do emprestado` });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label={tr({ en: "Lent", pt: "Emprestado" })} value={money(lent)} hint={tr({ en: `${book.length} loans`, pt: `${book.length} empréstimos` })} />
        <StatTile label={tr({ en: "Outstanding", pt: "Em aberto" })} value={money(outstanding)} hint={tr({ en: "principal", pt: "principal" })} hintTone="info" />
        <StatTile label={tr({ en: "Received", pt: "Recebido" })} value={money(received)} hint={tr({ en: "instalments", pt: "parcelas" })} hintTone="positive" />
        <StatTile label={tr({ en: "Domestic P2P", pt: "P2P Doméstico" })} value={money(byPool("domestic"))} hint={shareOfLent("domestic")} />
        <StatTile label={tr({ en: "Global P2P", pt: "P2P Global" })} value={money(byPool("global"))} hint={shareOfLent("global")} />
        <StatTile label={tr({ en: "Defaulted", pt: "Inadimplentes" })} value={defaulted.length} hint={money(defaulted.reduce((n, l) => n + outstandingCents({ ...l, status: "ACTIVE" }), 0))}
          hintTone={defaulted.length ? "alert" : "neutral"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "By risk band", pt: "Por faixa de risco" })}
          description={tr({
            en: "Principal lent, by the band EmpowerFI's eligibility rules gave each request.",
            pt: "Principal emprestado, pela faixa que as regras de elegibilidade da EmpowerFI deram a cada pedido.",
          })}>
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

        <Panel title={tr({ en: "What the capital did", pt: "O que o capital fez" })}
          description={tr({
            en: "Measured from her own reported months before and after the loan: sales, and the value the credit created after its cost (EVC, Economic Value Created). Proven on Solana.",
            pt: "Medido a partir dos meses que ela mesma reportou antes e depois do empréstimo: vendas e o valor que o crédito gerou depois do seu custo (EVC, Valor Econômico Criado). Registrado na Solana.",
          })}>
          {outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "Outcomes are measured once a loan has two reported months on each side.",
                pt: "Os resultados são medidos quando o empréstimo tem dois meses reportados de cada lado.",
              })}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {outcomes.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                    <span className="block text-xs text-muted-foreground">
                      {tr({
                        en: `Sales ${money(l.outcome!.avg_revenue_before_cents)} → ${money(l.outcome!.avg_revenue_after_cents)} a month`,
                        pt: `Vendas ${money(l.outcome!.avg_revenue_before_cents)} → ${money(l.outcome!.avg_revenue_after_cents)} ao mês`,
                      })} · {CAPITAL_USE_LABEL[l.outcome!.capital_use]}
                    </span>
                  </span>
                  <span className={`num text-sm font-semibold ${l.outcome!.evc_cents >= 0 ? "text-positive" : "text-alert"}`}><EvcLabel /> {money(l.outcome!.evc_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={tr({ en: "Loans", pt: "Empréstimos" })}
        description={tr({
          en: "Every loan you lent or approved. Open one for its schedule, where the money went, and each step's proof.",
          pt: "Cada empréstimo que você concedeu ou aprovou. Abra um para ver o cronograma, para onde foi o dinheiro e a prova de cada etapa.",
        })}>
        {desk.loans.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "No loans yet.", pt: "Nenhum empréstimo ainda." })}</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Loan", pt: "Empréstimo" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Principal", pt: "Principal" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Terms", pt: "Condições" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Status", pt: "Situação" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Paid", pt: "Pago" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Outstanding", pt: "Em aberto" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Capital", pt: "Capital" })}</th>
                  <th className="py-2 font-medium">{tr({ en: "Terms on chain", pt: "Condições na blockchain" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {desk.loans.map((l) => {
                  const o = oppOf.get(l.opportunity_id);
                  return (
                    <tr key={l.id} className="align-top">
                      <td className="py-3 pr-4">
                        <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                        <span className="block text-xs text-muted-foreground">{PURPOSE_LABEL[l.purpose]} · {sectorLabel(l.business_sector) ?? "—"}</span>
                      </td>
                      <td className="num py-3 pr-4 text-right text-foreground">{money(l.principal_cents)}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{l.term_months} × {money(l.instalment_cents)}<span className="block">{rate(l.rate_bps)}</span></td>
                      <td className="py-3 pr-4">{o ? <StagePill stage={stageOf(o, l)} /> : null}</td>
                      <td className="num py-3 pr-4 text-right text-foreground">{l.paid}/{l.term_months}<span className="block text-xs text-muted-foreground">{money(l.received_cents)}</span></td>
                      <td className="num py-3 pr-4 text-right text-foreground">{money(outstandingCents(l))}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {l.funding.status === "funded" ? tr({ en: `Investors (${l.funding.investors})`, pt: `Investidores (${l.funding.investors})` })
                          : l.funding.status === null ? tr({ en: "Your own", pt: "Próprio" })
                          : l.funding.status === "refunded" ? tr({ en: "Refunded", pt: "Reembolsado" })
                          : tr({ en: "Raising", pt: "Em captação" })}
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
