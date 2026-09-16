import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import ProofLine from "../../components/product/ProofLine";
import StatusPill from "../../components/product/StatusPill";
import { shortDate } from "../../lib/community";
import { CAPITAL_USE_LABEL, LOAN_LABEL } from "../../lib/credit";
import { RISK } from "../../lib/investor";
import { rate, stageOf } from "../../lib/partner";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
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
        <p className="text-muted-foreground">This loan does not exist, or it is not on your desk.</p>
        <Link to="/app/partner/portfolio" className="text-sm text-info">Back to the portfolio</Link>
      </div>
    );
  }

  const f = loan.funding;
  const fx = f.fx_brl_per_usdc_milli ?? desk.fx_brl_per_usdc_milli;
  const shares = loan.schedule.reduce((n, s) => n + (s.to_investors.done ? s.to_investors.amount_micro_usdc : 0), 0);

  return (
    <div className="space-y-6">
      <Link to="/app/partner/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Portfolio
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-2xl font-bold text-foreground">{loan.participant}</h2>
            <StagePill stage={stageOf(o, loan)} />
          </div>
          <p className="text-sm text-muted-foreground">
            {PURPOSE_LABEL[loan.purpose]} · {loan.business_sector ?? "—"} · {o.community_name ?? "—"} · {RISK[loan.risk_band].label}
          </p>
        </div>
        <LoanActions loan={loan} decides={decides} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Terms" description="Yours: the amount, the price and the term. Proven on Solana when you approved.">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Principal</dt><dd className="num text-foreground">{money(loan.principal_cents)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Rate</dt><dd className="num text-foreground">{rate(loan.rate_bps)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Instalments</dt><dd className="num text-foreground">{loan.term_months} × {money(loan.instalment_cents)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Received</dt><dd className="num text-foreground">{money(loan.received_cents)} · {loan.paid}/{loan.term_months}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Approved</dt><dd className="text-foreground">{shortDate(loan.created_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Disbursed</dt><dd className="text-foreground">{shortDate(loan.disbursed_at)}</dd></div>
          </dl>
          <div className="text-xs"><ProofLine proof={loan.proof} /></div>
        </Panel>
        <Panel title="Funding" description="Investors fund from eligibility onwards. You never see who they are.">
          <FundingSummary funding={f} />
          {(f.refund_due > 0 || f.refunded > 0) && (
            <p className="text-xs text-muted-foreground">{f.refunded} allocation{f.refunded === 1 ? "" : "s"} refunded, {f.refund_due} on the way.</p>
          )}
        </Panel>
      </div>

      <Panel title="Where the money went" description="From investors to her business and back, leg by leg. Real devnet transactions open on Solana Explorer; Pix is a mock in this demo.">
        <ol className="space-y-4">
          <Step n={1} title="Investors fund the opportunity" reality={f.real_micro_usdc > 0 ? "real" : "simulated"}>
            {f.status === null ? "Not funded by investors."
              : f.pool === "domestic" ? `Funded in reais by ${f.investors} domestic investor${f.investors === 1 ? "" : "s"}: a simulated BRL pool, no vault or conversion.`
              : `${usdc(f.funded_micro_usdc)} from ${f.investors} investor${f.investors === 1 ? "" : "s"} into the program's vault; ${usdc(f.real_micro_usdc)} of it real devnet USDC.`}
          </Step>
          <Step n={2} title={f.pool === "domestic" ? "No conversion: reais in, reais out" : "The vault releases it to the regulated off-ramp"} reality={loan.release ? "real" : "simulated"}>
            {loan.release ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                {usdc(loan.release.amount_micro_usdc)} released, in a transfer batched with other loans · {loan.release.status}
                {loan.release.signature && <ExplorerLink tx={loan.release.signature} />}
              </span>
            ) : loan.disbursed_at ? "No real USDC behind it: nothing leaves the vault." : "When you disburse."}
          </Step>
          <Step n={3} title="Her business is paid by Pix" reality="mock">
            {loan.pix_payout ? (
              <>
                {money(loan.pix_payout.amount_cents)} on {shortDate(loan.pix_payout.at)} · <span className="font-mono">{loan.pix_payout.e2e}</span>
                {loan.release && <span className="block">The released USDC is worth {money(reaisAtRamp(loan.release.amount_micro_usdc, fx, desk.ramp_bps))} at the demo quote, after the ramp's {(desk.ramp_bps / 100).toFixed(1)}% spread.</span>}
              </>
            ) : "When you disburse."}
          </Step>
          <Step n={4} title="She repays by Pix" reality="mock">
            {loan.paid ? `${loan.paid} instalment${loan.paid === 1 ? "" : "s"}, ${money(loan.received_cents)} in all. Each has its own Pix id, below.` : "No instalment yet."}
          </Step>
          <Step n={5} title="Investors' shares go back to them" reality={shares > 0 ? "real" : "simulated"}>
            {shares > 0 ? `${usdc(shares)} paid from the vault to investors' wallets, each transfer below.` : "Simulated investors move no USDC; a shielded-ZEC investor's share is held until they give a return address."}
          </Step>
        </ol>
      </Panel>

      <Panel title="Schedule" description="One instalment a month from when repayment started.">
        {loan.schedule.length === 0 ? <p className="text-sm text-muted-foreground">No schedule.</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                  <th className="py-2 pr-4 text-right font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Paid</th>
                  <th className="py-2 pr-4 font-medium">Pix in (mock)</th>
                  <th className="py-2 pr-4 font-medium">To investors</th>
                  <th className="py-2 font-medium">Proof</th>
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
                          {s.late && <StatusPill tone="caution" dot={false}>late</StatusPill>}
                        </span>
                      ) : s.late ? <StatusPill tone="alert">Overdue</StatusPill> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-[12rem] truncate py-2.5 pr-4 font-mono text-xs text-muted-foreground" title={s.pix_e2e ?? undefined}>{s.pix_e2e ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-xs">
                      {!s.payment_id ? <span className="text-muted-foreground">—</span>
                        : s.to_investors.amount_micro_usdc === 0 ? <span className="text-muted-foreground">No real investors</span>
                        : (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="num text-foreground">{usdc(s.to_investors.amount_micro_usdc)}</span>
                            {s.to_investors.pending > 0 && <StatusPill tone="info" dot={false}>sending</StatusPill>}
                            {s.to_investors.held > 0 && <StatusPill tone="neutral" dot={false}>{s.to_investors.held} held</StatusPill>}
                            {s.to_investors.failed > 0 && <StatusPill tone="alert" dot={false}>failed</StatusPill>}
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
        <Panel title="Status history" description="Each change is proven on Solana, in the order it happened.">
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
        <Panel title="Outcome" description="What the loan did for her business, from her own reported months.">
          {loan.outcome ? (
            <div className="space-y-2 text-sm">
              <p className="text-foreground">Sales {money(loan.outcome.avg_revenue_before_cents)} → {money(loan.outcome.avg_revenue_after_cents)} a month</p>
              <p className="text-muted-foreground">
                EVC {money(loan.outcome.evc_cents)} · {CAPITAL_USE_LABEL[loan.outcome.capital_use]} · {loan.outcome.confidence.toLowerCase()} confidence · measured {shortDate(loan.outcome.measured_at)}
              </p>
              <div className="text-xs"><ProofLine proof={loan.outcome.proof} /></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Measured once there are two reported months on each side of the loan.</p>}
        </Panel>
      </div>
    </div>
  );
}
