import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { tr } from "../../i18n";
import { shortDate } from "../../lib/community";
import { isRaising, stageOf } from "../../lib/partner";
import { money } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { useDesk } from "./context";
import { FundingSummary, LoanActions, StagePill } from "./parts";

const DAY = 86_400_000;

/**
 * The desk's servicing: loans to disburse once formalised, repayments to
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
        <StatTile label={tr({ en: "Due in the next 45 days", pt: "Vencem nos próximos 45 dias" })} value={upcoming.filter(({ s }) => !s.late).length}
          hint={money(upcoming.filter(({ s }) => !s.late).reduce((n, { s }) => n + s.amount_cents, 0))} />
        <StatTile label={tr({ en: "Overdue instalments", pt: "Parcelas em atraso" })} value={overdue.length} hint={money(overdue.reduce((n, { s }) => n + s.amount_cents, 0))}
          hintTone={overdue.length ? "alert" : "neutral"} />
        <StatTile label={tr({ en: "Collected this month", pt: "Recebido neste mês" })} value={money(collected.reduce((n, s) => n + s.amount_cents, 0))}
          hint={tr({ en: `${collected.length} instalments`, pt: `${collected.length} parcelas` })} hintTone="positive" />
        <StatTile label={tr({ en: "Back to investors", pt: "Devolvido aos investidores" })} value={usdc(back.done)}
          hint={back.held
            ? tr({ en: `${back.held} shares held`, pt: `${back.held} partes retidas` })
            : tr({ en: "real devnet USDC", pt: "USDC real na devnet" })} />
      </div>

      <Panel title={tr({ en: "To formalise", pt: "A formalizar" })}
        description={tr({
          en: "Approved by you. You sign and disburse once investors have funded it; if you decline now, they are refunded.",
          pt: "Aprovados por você. Você assina e desembolsa quando estiverem 100% captados; se recusar agora, os investidores são reembolsados.",
        })}>
        {approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr({ en: "No approved loan waits to be formalised.", pt: "Nenhum empréstimo aprovado espera formalização." })}</p>
        ) : (
          <ul className="divide-y divide-border">
            {approved.map((l) => {
              const o = oppOf.get(l.opportunity_id);
              return (
                <li key={l.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                    <p className="text-xs text-muted-foreground">{money(l.principal_cents)} · {l.term_months} × {money(l.instalment_cents)} · {tr({ en: `approved ${shortDate(l.created_at)}`, pt: `aprovado em ${shortDate(l.created_at)}` })}</p>
                    {o && <div className="mt-1"><StagePill stage={stageOf(o, l)} /></div>}
                  </div>
                  <FundingSummary funding={l.funding} />
                  <div className="md:justify-self-end">
                    {decides ? <LoanActions loan={l} decides /> : (
                      <span className="text-xs text-muted-foreground">{isRaising(l.funding) ? tr({ en: "Waiting for investors", pt: "Aguardando investidores" }) : tr({ en: "Ready to disburse", pt: "Pronto para desembolsar" })}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={tr({ en: "Repayments", pt: "Pagamentos" })}
        description={tr({
          en: "Instalments fall due a month apart from when repayment starts. Each one recorded is proven on Solana, paid by her through Pix (a mock here), and its investors' shares go back to them.",
          pt: "As parcelas vencem uma por mês a partir do início dos pagamentos. Cada parcela registrada tem prova na Solana, é paga por ela via Pix (simulado aqui), e as partes dos investidores voltam para eles.",
        })}>
        {repaying.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "No loan is repaying.", pt: "Nenhum empréstimo em pagamento." })}</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Loan", pt: "Empréstimo" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Next due", pt: "Próximo vencimento" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Paid", pt: "Pago" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Status", pt: "Situação" })}</th>
                  <th className="py-2 font-medium">{decides ? tr({ en: "Record", pt: "Registrar" }) : tr({ en: "Next step", pt: "Próximo passo" })}</th>
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
                          : <span className="text-muted-foreground">{l.status === "DISBURSED" ? tr({ en: "Starts with repayment", pt: "Começa com os pagamentos" }) : "—"}</span>}
                        {l.overdue > 0 && (
                          <span className="mt-0.5 flex items-center gap-1 text-alert"><AlertTriangle size={12} aria-hidden /> {tr({ en: `${l.overdue} overdue`, pt: `${l.overdue} em atraso` })}</span>
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

      <Panel title={tr({ en: "Calendar", pt: "Calendário" })}
        description={tr({
          en: "Unpaid instalments due in the next 45 days, and every one already late.",
          pt: "Parcelas não pagas que vencem nos próximos 45 dias, e todas as que já estão atrasadas.",
        })}>
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "Nothing falls due in the next 45 days.", pt: "Nada vence nos próximos 45 dias." })}</p> : (
          <ul className="divide-y divide-border">
            {upcoming.map(({ l, s }) => (
              <li key={`${l.id}-${s.instalment_no}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`num w-24 shrink-0 text-xs ${s.late ? "text-alert" : "text-muted-foreground"}`}>{shortDate(s.due_at)}</span>
                  <Link to={`../loans/${l.id}`} relative="path" className="font-mono text-foreground hover:underline">{l.participant}</Link>
                  <span className="text-xs text-muted-foreground">
                    {tr({ en: `instalment ${s.instalment_no} of ${l.term_months}`, pt: `parcela ${s.instalment_no} de ${l.term_months}` })}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="num text-foreground">{money(s.amount_cents)}</span>
                  <StatusPill tone={s.late ? "alert" : "info"}>{s.late ? tr({ en: "Late", pt: "Atrasada" }) : tr({ en: "Due", pt: "A vencer" })}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
