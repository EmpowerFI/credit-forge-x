import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import ProofLine from "../../components/product/ProofLine";
import StatusPill from "../../components/product/StatusPill";
import { formatNumber, tr } from "../../i18n";
import { shortDate } from "../../lib/community";
import { CAPITAL_USE_LABEL, LOAN_LABEL } from "../../lib/credit";
import { RISK } from "../../lib/investor";
import { level, rate, stageOf } from "../../lib/partner";
import { money, PURPOSE_LABEL, sectorLabel } from "../../lib/readiness";
import { REALITY, reaisAtRamp, type Reality } from "../../lib/settlement";
import { usdc } from "../../lib/solana";
import { useDesk } from "./context";
import { FundingSummary, LoanActions, StagePill } from "./parts";

function Step({ n, title, reality, children }: { n: number; title: string; reality: Reality; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">{n}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          {title} <StatusPill tone={REALITY[reality].tone} dot={false}>{REALITY[reality].label}</StatusPill>
        </p>
        <div className="text-xs text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

/** One loan on EmpowerFI's P2P desk: its terms, where the money went, the schedule, and each step's proof. */
export default function Loan() {
  const { id } = useParams();
  const { desk, decides } = useDesk();
  const loan = desk.loans.find((l) => l.id === id);
  const o = desk.opportunities.find((x) => x.opportunity_id === loan?.opportunity_id);

  if (!loan || !o) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-muted-foreground">{tr({ en: "This loan does not exist, or it is not on your desk.", pt: "Este empréstimo não existe ou não está na sua mesa." })}</p>
        <Link to="/app/partner/portfolio" className="text-sm text-info">{tr({ en: "Back to the portfolio", pt: "Voltar para a carteira" })}</Link>
      </div>
    );
  }

  const f = loan.funding;
  const fx = f.fx_brl_per_usdc_milli ?? desk.fx_brl_per_usdc_milli;
  const shares = loan.schedule.reduce((n, s) => n + (s.to_investors.done ? s.to_investors.amount_micro_usdc : 0), 0);
  const spread = formatNumber(desk.ramp_bps / 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const whenYouDisburse = tr({ en: "When you disburse.", pt: "Quando você desembolsar." });
  const investors = (n: number) => tr({ en: `${n} investor${n === 1 ? "" : "s"}`, pt: `${n} ${n === 1 ? "investidor" : "investidores"}` });
  const dt = (en: string, pt: string) => <dt className="text-xs text-muted-foreground">{tr({ en, pt })}</dt>;

  return (
    <div className="space-y-6">
      <Link to="/app/partner/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> {tr({ en: "Portfolio", pt: "Carteira" })}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-2xl font-bold text-foreground">{loan.participant}</h2>
            <StagePill stage={stageOf(o, loan)} />
          </div>
          <p className="text-sm text-muted-foreground">
            {PURPOSE_LABEL[loan.purpose]} · {sectorLabel(loan.business_sector) ?? "—"} · {o.community_name ?? "—"} · {RISK[loan.risk_band].label}
          </p>
        </div>
        <LoanActions loan={loan} decides={decides} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Terms", pt: "Condições" })}
          description={tr({
            en: "Yours: the amount, the price and the term. Proven on Solana when you approved.",
            pt: "Suas: o valor, o preço e o prazo. Registradas na Solana quando você aprovou.",
          })}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>{dt("Principal", "Principal")}<dd className="num text-foreground">{money(loan.principal_cents)}</dd></div>
            <div>{dt("Rate", "Taxa")}<dd className="num text-foreground">{rate(loan.rate_bps)}</dd></div>
            <div>{dt("Instalments", "Parcelas")}<dd className="num text-foreground">{loan.term_months} × {money(loan.instalment_cents)}</dd></div>
            <div>{dt("Received", "Recebido")}<dd className="num text-foreground">{money(loan.received_cents)} · {loan.paid}/{loan.term_months}</dd></div>
            <div>{dt("Approved", "Aprovado em")}<dd className="text-foreground">{shortDate(loan.created_at)}</dd></div>
            <div>{dt("Disbursed", "Desembolsado em")}<dd className="text-foreground">{shortDate(loan.disbursed_at)}</dd></div>
          </dl>
          <div className="text-xs"><ProofLine proof={loan.proof} /></div>
        </Panel>
        <Panel title={tr({ en: "Funding", pt: "Captação" })}
          description={tr({ en: "Investors fund from eligibility onwards. You never see who they are.", pt: "Os investidores aportam a partir da elegibilidade. Você nunca vê quem eles são." })}>
          <FundingSummary funding={f} />
          {(f.refund_due > 0 || f.refunded > 0) && (
            <p className="text-xs text-muted-foreground">
              {tr({
                en: `${f.refunded} allocation${f.refunded === 1 ? "" : "s"} refunded, ${f.refund_due} on the way.`,
                pt: `${f.refunded} ${f.refunded === 1 ? "alocação reembolsada" : "alocações reembolsadas"}, ${f.refund_due} a caminho.`,
              })}
            </p>
          )}
        </Panel>
      </div>

      <Panel title={tr({ en: "Where the money went", pt: "Para onde foi o dinheiro" })}
        description={tr({
          en: "From investors to her business and back, leg by leg. Real devnet transactions open on Solana Explorer; Pix is a mock in this demo.",
          pt: "Dos investidores para o negócio dela e de volta, etapa por etapa. Transações reais na devnet abrem no Solana Explorer; o Pix é simulado nesta demo.",
        })}>
        <ol className="space-y-4">
          <Step n={1} title={tr({ en: "Investors fund the opportunity", pt: "Investidores aportam na oportunidade" })} reality={f.real_micro_usdc > 0 ? "real" : "simulated"}>
            {f.status === null ? tr({ en: "Not funded by investors.", pt: "Sem captação com investidores." })
              : f.pool === "domestic" ? tr({
                en: `Funded in reais by ${f.investors} domestic investor${f.investors === 1 ? "" : "s"}: a simulated BRL pool, no vault or conversion.`,
                pt: `Captada em reais com ${f.investors} ${f.investors === 1 ? "investidor doméstico" : "investidores domésticos"}: um pool simulado em BRL, sem cofre nem conversão.`,
              })
              : tr({
                en: `${usdc(f.funded_micro_usdc)} from ${investors(f.investors)} into the program's vault; ${usdc(f.real_micro_usdc)} of it real devnet USDC.`,
                pt: `${usdc(f.funded_micro_usdc)} de ${investors(f.investors)} para o cofre do programa; ${usdc(f.real_micro_usdc)} disso em USDC real na devnet.`,
              })}
          </Step>
          <Step n={2} reality={loan.release ? "real" : "simulated"}
            title={f.pool === "domestic"
              ? tr({ en: "No conversion: reais in, reais out", pt: "Sem conversão: entram reais, saem reais" })
              : tr({ en: "The vault releases it to the regulated off-ramp", pt: "O cofre libera o valor para o off-ramp regulado" })}>
            {loan.release ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                {tr({
                  en: `${usdc(loan.release.amount_micro_usdc)} released, in a transfer batched with other loans`,
                  pt: `${usdc(loan.release.amount_micro_usdc)} liberados, numa transferência agrupada com outros empréstimos`,
                })} · {loan.release.status}
                {loan.release.signature && <ExplorerLink tx={loan.release.signature} />}
              </span>
            ) : loan.disbursed_at ? tr({ en: "No real USDC behind it: nothing leaves the vault.", pt: "Sem USDC real por trás: nada sai do cofre." }) : whenYouDisburse}
          </Step>
          <Step n={3} title={tr({ en: "Her business is paid by Pix", pt: "O negócio dela recebe por Pix" })} reality="mock">
            {loan.pix_payout ? (
              <>
                {tr({
                  en: `${money(loan.pix_payout.amount_cents)} on ${shortDate(loan.pix_payout.at)}`,
                  pt: `${money(loan.pix_payout.amount_cents)} em ${shortDate(loan.pix_payout.at)}`,
                })} · <span className="font-mono">{loan.pix_payout.e2e}</span>
                {loan.release && (
                  <span className="block">
                    {tr({
                      en: `The released USDC is worth ${money(reaisAtRamp(loan.release.amount_micro_usdc, fx, desk.ramp_bps))} at the demo quote, after the ramp's ${spread}% spread.`,
                      pt: `O USDC liberado vale ${money(reaisAtRamp(loan.release.amount_micro_usdc, fx, desk.ramp_bps))} na cotação da demo, depois do spread de ${spread}% da rampa.`,
                    })}
                  </span>
                )}
              </>
            ) : whenYouDisburse}
          </Step>
          <Step n={4} title={tr({ en: "She repays by Pix", pt: "Ela paga por Pix" })} reality="mock">
            {loan.paid
              ? tr({
                en: `${loan.paid} instalment${loan.paid === 1 ? "" : "s"}, ${money(loan.received_cents)} in all. Each has its own Pix id, below.`,
                pt: `${loan.paid} ${loan.paid === 1 ? "parcela" : "parcelas"}, ${money(loan.received_cents)} no total. Cada uma tem seu próprio id Pix, abaixo.`,
              })
              : tr({ en: "No instalment yet.", pt: "Nenhuma parcela ainda." })}
          </Step>
          <Step n={5} title={tr({ en: "Investors' shares go back to them", pt: "As partes dos investidores voltam para eles" })} reality={shares > 0 ? "real" : "simulated"}>
            {shares > 0
              ? tr({
                en: `${usdc(shares)} paid from the vault to investors' wallets, each transfer below.`,
                pt: `${usdc(shares)} pagos do cofre para as carteiras dos investidores; cada transferência está abaixo.`,
              })
              : tr({
                en: "Simulated investors move no USDC; a shielded-ZEC investor's share is held until they give a return address.",
                pt: "Investidores simulados não movimentam USDC; a parte de quem investiu com ZEC blindado fica retida até que informe um endereço de retorno.",
              })}
          </Step>
        </ol>
      </Panel>

      <Panel title={tr({ en: "Schedule", pt: "Cronograma" })}
        description={tr({ en: "One instalment a month from when repayment started.", pt: "Uma parcela por mês desde o início dos pagamentos." })}>
        {loan.schedule.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "No schedule.", pt: "Sem cronograma." })}</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Due", pt: "Vencimento" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Amount", pt: "Valor" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Paid", pt: "Paga em" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Pix in (mock)", pt: "Pix recebido (simulado)" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "To investors", pt: "Para investidores" })}</th>
                  <th className="py-2 font-medium">{tr({ en: "Proof", pt: "Prova" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loan.schedule.map((s) => (
                  <tr key={s.instalment_no} className="align-top">
                    <td className="num py-2.5 pr-4 text-muted-foreground">{s.instalment_no}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{s.due_at ? shortDate(s.due_at) : "—"}</td>
                    <td className="num py-2.5 pr-4 text-right text-foreground">{money(s.amount_cents)}</td>
                    <td className="py-2.5 pr-4 text-xs">
                      {s.paid_at ? (
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <Check size={13} className="text-positive" aria-hidden /> {shortDate(s.paid_at)}
                          {s.late && <StatusPill tone="caution" dot={false}>{tr({ en: "late", pt: "atrasada" })}</StatusPill>}
                        </span>
                      ) : s.late ? <StatusPill tone="alert">{tr({ en: "Overdue", pt: "Em atraso" })}</StatusPill> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-[12rem] truncate py-2.5 pr-4 font-mono text-xs text-muted-foreground" title={s.pix_e2e ?? undefined}>{s.pix_e2e ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-xs">
                      {!s.payment_id ? <span className="text-muted-foreground">—</span>
                        : s.to_investors.amount_micro_usdc === 0 ? <span className="text-muted-foreground">{tr({ en: "No real investors", pt: "Sem investidores reais" })}</span>
                        : (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="num text-foreground">{usdc(s.to_investors.amount_micro_usdc)}</span>
                            {s.to_investors.pending > 0 && <StatusPill tone="info" dot={false}>{tr({ en: "sending", pt: "enviando" })}</StatusPill>}
                            {s.to_investors.held > 0 && <StatusPill tone="neutral" dot={false}>{tr({ en: `${s.to_investors.held} held`, pt: `${s.to_investors.held} retidas` })}</StatusPill>}
                            {s.to_investors.failed > 0 && <StatusPill tone="alert" dot={false}>{tr({ en: "failed", pt: "falhou" })}</StatusPill>}
                            {s.to_investors.signatures.map((sig) => <ExplorerLink key={sig} tx={sig} />)}
                          </span>
                        )}
                    </td>
                    <td className="py-2.5 text-xs">{s.payment_id ? <ProofLine proof={s.proof} /> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Status history", pt: "Histórico da situação" })}
          description={tr({ en: "Each change is proven on Solana, in the order it happened.", pt: "Cada mudança é registrada na Solana, na ordem em que aconteceu." })}>
          <ol className="space-y-3">
            {loan.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="text-foreground">{LOAN_LABEL[e.to_status]}</span>
                  {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                  <span className="block text-xs text-muted-foreground">{shortDate(e.at)}</span>
                </span>
                <span className="text-xs"><ProofLine proof={e.proof} /></span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={tr({ en: "Outcome", pt: "Resultado" })}
          description={tr({ en: "What the loan did for her business, from her own reported months.", pt: "O que o empréstimo fez pelo negócio dela, a partir dos meses que ela mesma reportou." })}>
          {loan.outcome ? (
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                {tr({
                  en: `Sales ${money(loan.outcome.avg_revenue_before_cents)} → ${money(loan.outcome.avg_revenue_after_cents)} a month`,
                  pt: `Vendas ${money(loan.outcome.avg_revenue_before_cents)} → ${money(loan.outcome.avg_revenue_after_cents)} ao mês`,
                })}
              </p>
              <p className="text-muted-foreground">
                EVC {money(loan.outcome.evc_cents)} · {CAPITAL_USE_LABEL[loan.outcome.capital_use]} · {tr({
                  en: `${level(loan.outcome.confidence)} confidence · measured ${shortDate(loan.outcome.measured_at)}`,
                  pt: `confiança ${level(loan.outcome.confidence, "f")} · medido em ${shortDate(loan.outcome.measured_at)}`,
                })}
              </p>
              <div className="text-xs"><ProofLine proof={loan.outcome.proof} /></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "Measured once there are two reported months on each side of the loan.",
                pt: "Medido quando houver dois meses reportados de cada lado do empréstimo.",
              })}
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
