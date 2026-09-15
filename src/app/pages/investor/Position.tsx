import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, Circle, ExternalLink, Loader2 } from "lucide-react";
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
import { POOL_LABEL, usdPerZec, zcashExplorerTx, zec } from "../../lib/zcash";
import { type PayoutStatus, reaisAtRamp, REALITY, type Reality } from "../../lib/settlement";

function RouteStep({ n, title, reality, children }: { n: number; title: string; reality: Reality | null; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-0.5 text-sm">
      <span className="num row-span-2 flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">{n}</span>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-foreground">{title}</span>
        {reality && <StatusPill tone={REALITY[reality].tone}>{REALITY[reality].label}</StatusPill>}
      </span>
      <span className="text-xs text-muted-foreground">{children}</span>
    </li>
  );
}

function PayoutCell({ payout, simulated }: { payout: PositionData["schedule"][number]["payout"]; simulated: boolean }) {
  if (simulated) return <span className="text-xs text-muted-foreground">simulated</span>;
  if (!payout) return <span className="text-xs text-muted-foreground">—</span>;
  if (payout.status === "done" && payout.signature) return <ExplorerLink tx={payout.signature} />;
  if (payout.status === "held") return <span className="text-xs text-caution">held: no wallet</span>;
  if (payout.status === "failed") return <span className="text-xs text-alert">failed</span>;
  return <span className="text-xs text-muted-foreground">on its way</span>;
}

// One position as a financial position you can follow: the deposit, the
// proof of the allocation, the loan's schedule and servicing, and the outcome.

interface PositionData {
  investment: { id: string; amount_micro_usdc: number; share_bps: number; mode: string; status: "allocated" | "refund_due" | "refunded";
    deposit_signature: string | null; wallet_address: string | null; invested_at: string; is_simulated: boolean;
    refund_signature: string | null; refunded_at: string | null };
  zcash: { ref: string; txid: string | null; pool: string | null; amount_zat: number; received_zat: number | null; usd_per_zec_cents: number;
    quote_source: string; mined_height: number | null; confirmed_at: string | null; credit_signature: string | null } | null;
  proof: { status: string; signature: string | null; account: string | null; commitment: string | null; reconcile: string } | null;
  opportunity: { id: string; code: string; purpose: CreditPurpose; business_sector: string | null; amount_cents: number; term_months: number;
    risk_band: Grade; funding_status: FundingStatus; funding_target_micro_usdc: number; fx_brl_per_usdc_milli: number };
  loan: { id: string; status: LoanStatus; principal_cents: number; rate_bps: number; term_months: number; instalment_cents: number;
    disbursed_at: string | null; active_since: string | null; instalment_share_micro_usdc: number } | null;
  settlement: {
    ramp_bps: number;
    release: { status: PayoutStatus; amount_micro_usdc: number; signature: string | null; transfer_micro_usdc: number | null;
      loans_in_transfer: number; at: string | null } | null;
    pix: { e2e: string; brl_cents: number; at: string | null } | null;
  } | null;
  schedule: { instalment_no: number; due_at: string | null; paid_at: string | null; payment_id: string | null; share_micro_usdc: number | null;
    pix_e2e: string | null; payout: { status: PayoutStatus; amount_micro_usdc: number; signature: string | null } | null }[];
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
  const { investment: inv, zcash, proof, opportunity: opp, loan, settlement, schedule, servicing, outcome } = position.data;
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
        <Panel title="Investment"
          description={zcash ? "Paid with shielded ZEC, credited to the program's vault in USDC, and the proof of where it went."
            : "Your deposit into the program's vault, and the proof of where it went."}>
          <dl className="space-y-3 text-sm">
            {zcash && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground"><DataTag kind="private" /> Shielded payment</dt>
                  <dd className="text-right">
                    <span className="num text-foreground">{zec(zcash.received_zat ?? zcash.amount_zat)}</span>
                    {zcash.pool && <span className="text-xs text-muted-foreground"> · {POOL_LABEL[zcash.pool]}</span>}
                    {zcash.txid && (
                      <a href={zcashExplorerTx(zcash.txid)} target="_blank" rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
                        {zcash.txid.slice(0, 4)}…{zcash.txid.slice(-4)} <ExternalLink size={11} aria-hidden />
                      </a>
                    )}
                  </dd>
                </div>
                <p className="text-xs text-muted-foreground">
                  On Zcash the amount, the memo ({zcash.ref}) and who paid are encrypted: the explorer shows only that a transaction happened.
                  Converted at {usdPerZec(zcash.usd_per_zec_cents)} per ZEC{zcash.quote_source === "demo" ? " (demo quote)" : ""}; the conversion itself is simulated on testnet.
                </p>
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{zcash ? "Credited to the vault" : "Deposit transaction"}</dt>
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

      <Panel title="Where the money went" description="Your capital's route to her business and back, leg by leg: which are transactions you can open, and which are simulated.">
        <ol className="space-y-4">
          <RouteStep n={1} title={zcash ? "Paid in shielded ZEC, credited to the vault" : "Into the program's vault"}
            reality={inv.is_simulated ? "simulated" : "real"}>
            {inv.deposit_signature ? <>{usdc(inv.amount_micro_usdc)} · <ExplorerLink tx={inv.deposit_signature} /></> : "A simulated position: no USDC moved."}
          </RouteStep>
          <RouteStep n={2} title="Released to the ramp partner" reality={!loan?.disbursed_at ? null : inv.is_simulated ? "simulated" : "real"}>
            {!loan?.disbursed_at ? "When the partner disburses the loan."
              : inv.is_simulated || !settlement?.release ? "Nothing real to release for this position."
              : settlement.release.status === "done" && settlement.release.signature ? (
                <>
                  With the loan's other real deposits, {usdc(settlement.release.amount_micro_usdc)}
                  {settlement.release.loans_in_transfer > 1 && <>, in one transfer covering {settlement.release.loans_in_transfer} loans</>} · <ExplorerLink tx={settlement.release.signature} />
                </>
              ) : "Leaving the vault now."}
          </RouteStep>
          <RouteStep n={3} title="Converted to reais" reality={loan?.disbursed_at ? "simulated" : null}>
            {loan?.disbursed_at
              ? <>Your {usdc(inv.amount_micro_usdc)} ≈ {money(reaisAtRamp(inv.amount_micro_usdc, opp.fx_brl_per_usdc_milli, settlement?.ramp_bps ?? 50))} at R$ {(opp.fx_brl_per_usdc_milli / 1000).toFixed(2)} per USDC, less the ramp's {((settlement?.ramp_bps ?? 50) / 100).toFixed(2)}%.</>
              : "At the ramp, once released."}
          </RouteStep>
          <RouteStep n={4} title="Paid to her business by Pix" reality={settlement?.pix ? "mock" : null}>
            {settlement?.pix
              ? <>{money(settlement.pix.brl_cents)}, the whole loan · {date(settlement.pix.at)} · <span className="break-all font-mono">{settlement.pix.e2e}</span></>
              : "The partner pays her when it disburses."}
          </RouteStep>
          <RouteStep n={5} title="Instalments come back to you" reality={schedule.some((s) => s.payment_id) ? (inv.is_simulated ? "simulated" : "real") : null}>
            {inv.is_simulated ? "Simulated: your share of each instalment is shown, not paid."
              : !inv.wallet_address ? "She pays each instalment by Pix (a mock). Your share is held: this position has no Solana wallet to pay it to. In production it would go back as ZEC, through the same conversion."
              : `She pays each instalment by Pix (a mock); the ramp returns your share to the vault, which pays it to your wallet in the same transaction. ${schedule.filter((s) => s.payout?.status === "done").length} of ${schedule.filter((s) => s.payment_id).length} paid out so far.`}
          </RouteStep>
        </ol>
      </Panel>

      {loan && (
        <Panel title="Scheduled repayments" description="Instalments fall due monthly from the start of repayment; your share is paid out in USDC at the demo quote.">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Your share</th>
                  <th className="py-2 pr-4 font-medium">Paid out</th>
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
                      <td className="py-2.5 pr-4">{s.payment_id ? <PayoutCell payout={s.payout} simulated={inv.is_simulated} /> : null}</td>
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
