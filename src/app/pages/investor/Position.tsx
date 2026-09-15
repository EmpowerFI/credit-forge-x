import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, Circle, Loader2 } from "lucide-react";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { CAPITAL_USE_LABEL, LOAN_LABEL, type CapitalUse, type LoanStatus } from "../../lib/credit";
import { type FundingStatus, type Grade, positionState, RISK, title } from "../../lib/investor";
import { platform } from "../../lib/platform";
import { money, type CreditPurpose } from "../../lib/readiness";
import { usdc } from "../../lib/solana";

// One position as a financial position you can follow: the deposit, the
// proof of the allocation, the loan's schedule and servicing, and the outcome.

interface PositionData {
  investment: { id: string; amount_micro_usdc: number; share_bps: number; mode: string; status: "allocated" | "refund_due" | "refunded";
    deposit_signature: string | null; wallet_address: string | null; invested_at: string; is_simulated: boolean;
    refund_signature: string | null; refunded_at: string | null };
  proof: { status: string; signature: string | null; account: string | null; commitment: string | null; reconcile: string } | null;
  opportunity: { id: string; code: string; purpose: CreditPurpose; business_sector: string | null; amount_cents: number; term_months: number;
    risk_band: Grade; funding_status: FundingStatus; funding_target_micro_usdc: number; fx_brl_per_usdc_milli: number };
  loan: { id: string; status: LoanStatus; principal_cents: number; rate_bps: number; term_months: number; instalment_cents: number;
    disbursed_at: string | null; active_since: string | null; instalment_share_micro_usdc: number } | null;
  schedule: { instalment_no: number; due_at: string | null; paid_at: string | null; payment_id: string | null; share_micro_usdc: number | null }[];
  servicing: { event_id: string; to_status: LoanStatus; note: string | null; at: string }[];
  outcome: { id: string; avg_revenue_before_cents: number; avg_revenue_after_cents: number; evc_cents: number; capital_use: CapitalUse;
    confidence: Grade; measured_at: string } | null;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function Position() {
  const { id } = useParams();
  const position = useQuery({
    queryKey: ["platform", "investor-position", id],
    queryFn: async () => {
      const { data, error } = await platform.rpc("investor_position", { p_investment_id: id! });
      if (error) throw error;
      return data as unknown as PositionData;
    },
  });
  if (position.isPending) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;
  if (position.isError) return <LoadError error={position.error} onRetry={() => position.refetch()} />;
  const { investment: inv, proof, opportunity: opp, loan, schedule, servicing, outcome } = position.data;
  const state = positionState({ status: inv.status, loan_status: loan?.status ?? null, funding_status: opp.funding_status });
  const repaid = schedule.reduce((s, i) => s + (i.share_micro_usdc ?? 0), 0);
  const expected = loan ? loan.instalment_share_micro_usdc * loan.term_months : null;
  const now = Date.now();

  return (
    <div className="space-y-6">
      <Link to="/app/investor/portfolio" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Portfolio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title(opp.purpose, opp.business_sector)}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{opp.code}</span> · Risk {RISK[opp.risk_band].grade} · {opp.term_months} months ·{" "}
            <Link to={`/app/investor/opportunities/${opp.id}`} className="text-info hover:underline">opportunity snapshot</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inv.is_simulated && <StatusPill tone="caution">Simulated position</StatusPill>}
          <StatusPill tone={state.tone}>{state.label}</StatusPill>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Invested" value={usdc(inv.amount_micro_usdc)} hint={date(inv.invested_at)} />
        <StatTile label="Your share of the loan" value={`${(inv.share_bps / 100).toFixed(1)}%`} hint={money(opp.amount_cents)} />
        <StatTile label="Repaid to you" value={usdc(repaid)} hintTone="positive" hint={loan ? `${schedule.filter((s) => s.paid_at).length} of ${loan.term_months} instalments` : "not disbursed"} />
        <StatTile label="Scheduled back" value={expected !== null ? usdc(expected) : "—"} hint={loan ? `at ${(loan.rate_bps / 100).toFixed(1)}%/month · demo quote` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Investment" description="Your deposit into the program's vault, and the proof of where it went.">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Deposit transaction</dt>
              <dd>{inv.deposit_signature ? <ExplorerLink tx={inv.deposit_signature} /> : <span className="text-caution">simulated, no deposit</span>}</dd>
            </div>
            {inv.status !== "allocated" && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Refund from the vault</dt>
                <dd>
                  {inv.refund_signature ? <ExplorerLink tx={inv.refund_signature} />
                    : inv.is_simulated ? <span className="text-caution">simulated, nothing to return</span>
                    : <span className="text-caution">on its way</span>}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground"><DataTag kind="proven" /> Allocation commitment</dt>
              <dd className="flex items-center gap-2">
                {proof?.signature && <ExplorerLink tx={proof.signature} />}
                <StatusPill tone={proof?.status === "confirmed" ? "positive" : "caution"}>
                  {proof?.reconcile === "verified" ? "Verified" : proof?.status === "confirmed" ? "On-chain" : "Queued"}
                </StatusPill>
              </dd>
            </div>
            <p className="text-xs text-muted-foreground">
              The chain sees your deposit into the vault and a commitment keyed by a random reference — not which loan it funds,
              and nothing about the entrepreneur.
            </p>
            <Link to={`/app/audit/allocation/${inv.id}`} className="inline-flex items-center gap-1 text-sm text-positive hover:underline">
              <BadgeCheck size={15} /> Verify on Solana
            </Link>
          </dl>
        </Panel>

        <Panel title="Servicing" description="What the partner recorded, as you may read it.">
          {servicing.length === 0 ? (
            <p className="text-sm text-muted-foreground">The partner formalises the loan once the opportunity is fully funded.</p>
          ) : (
            <ol className="space-y-3">
              {servicing.map((e) => (
                <li key={e.event_id} className="flex items-start gap-3 text-sm">
                  <Check size={16} className="mt-0.5 text-positive" />
                  <span className="flex-1">
                    <span className="text-foreground">{LOAN_LABEL[e.to_status]}</span>
                    {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                    <span className="block text-xs text-muted-foreground">{date(e.at)}</span>
                  </span>
                  <Link to={`/app/audit/loan_transition/${e.event_id}`} className="text-xs text-positive hover:underline">Verify</Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {loan && (
        <Panel title="Scheduled repayments" description="Instalments fall due monthly from the start of repayment; your share is paid out in USDC at the demo quote.">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Your share</th>
                  <th className="py-2 font-medium"><span className="sr-only">Proof</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedule.map((s) => {
                  const late = !s.paid_at && s.due_at && new Date(s.due_at).getTime() + 30 * 86_400_000 < now;
                  return (
                    <tr key={s.instalment_no}>
                      <td className="num py-2.5 pr-4 text-muted-foreground">{s.instalment_no}</td>
                      <td className="py-2.5 pr-4 text-foreground">{s.due_at ? date(s.due_at) : "after repayment starts"}</td>
                      <td className="py-2.5 pr-4">
                        {s.paid_at ? <StatusPill tone="positive">Paid {date(s.paid_at)}</StatusPill>
                          : late ? <StatusPill tone="alert">Late</StatusPill>
                          : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Circle size={10} /> Scheduled</span>}
                      </td>
                      <td className="num py-2.5 pr-4 text-right text-foreground">{usdc(s.share_micro_usdc ?? loan.instalment_share_micro_usdc)}</td>
                      <td className="py-2.5 text-right">
                        {s.payment_id && <Link to={`/app/audit/payment/${s.payment_id}`} className="text-xs text-positive hover:underline">Verify</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {outcome && (
        <Panel title="Productive outcome · simulated"
          description="Measured from the months the business reports: before the loan's month against after it. What changed after the loan, not what the loan caused.">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Monthly sales</p><p className="num text-foreground">{money(outcome.avg_revenue_before_cents)} → {money(outcome.avg_revenue_after_cents)}</p></div>
            <div><p className="text-xs text-muted-foreground">EVC</p><p className={`num ${outcome.evc_cents >= 0 ? "text-positive" : "text-alert"}`}>{money(outcome.evc_cents)}</p></div>
            <div><p className="text-xs text-muted-foreground">Use of capital</p><p className="text-foreground">{CAPITAL_USE_LABEL[outcome.capital_use]}</p></div>
            <div><p className="text-xs text-muted-foreground">Confidence</p><p className="text-foreground">{outcome.confidence.toLowerCase()} · {date(outcome.measured_at)}</p></div>
          </div>
        </Panel>
      )}
    </div>
  );
}
