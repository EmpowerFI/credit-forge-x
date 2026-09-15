import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { type PortfolioRow, positionState, RISK, title } from "../../lib/investor";
import { money, PURPOSE_LABEL, type CreditPurpose } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { usePortfolio } from "./queries";


export default function Portfolio() {
  const portfolio = usePortfolio();
  const navigate = useNavigate();
  if (portfolio.isError) return <LoadError error={portfolio.error} onRetry={() => portfolio.refetch()} />;
  const p = portfolio.data;
  const rows = p?.rows ?? [];
  const count = (f: (r: PortfolioRow) => boolean) => rows.filter(f).length;
  const byPurpose = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.purpose]: (acc[r.purpose] ?? 0) + r.amount_micro_usdc }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const total = Math.max(1, rows.reduce((s, r) => s + r.amount_micro_usdc, 0));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Investor console" title="Portfolio"
        description="Every position you hold: what it funds, where the loan stands, what has come back to you, and the proof of each step." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {p ? (
          <>
            <StatTile label="Active" value={count((r) => r.loan_status === "ACTIVE" || r.loan_status === "DISBURSED")} hint="repaying or disbursed" />
            <StatTile label="Raising" value={count((r) => r.status === "allocated" && (!r.loan_status || r.loan_status === "PARTNER_APPROVED"))} hint="before disbursement" />
            <StatTile label="Paid off" value={count((r) => r.loan_status === "PAID")} hintTone="positive" hint="fully repaid" />
            <StatTile label="Delinquent / defaulted" value={count((r) => r.loan_status === "DEFAULTED")} hintTone="alert" />
            <StatTile label="Refund due" value={count((r) => r.status !== "allocated")} hintTone="caution" hint="partner declined" />
          </>
        ) : [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-card" />)}
      </div>

      {p && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Principal">
            <dl className="num grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Invested</dt><dd className="text-right text-foreground">{usdc(p.invested_micro_usdc)}</dd>
              <dt className="text-muted-foreground">Deployed</dt><dd className="text-right text-foreground">{usdc(p.deployed_micro_usdc)}</dd>
              <dt className="text-muted-foreground">Repaid to you</dt><dd className="text-right text-positive">{usdc(p.repaid_micro_usdc)}</dd>
              <dt className="text-muted-foreground">Expected · demo</dt><dd className="text-right text-foreground">{usdc(p.expected_micro_usdc)}</dd>
            </dl>
          </Panel>
          <Panel title="By purpose">
            <ul className="space-y-2.5">
              {byPurpose.map(([purpose, micro]) => (
                <li key={purpose} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{PURPOSE_LABEL[purpose as CreditPurpose]}</span>
                    <span className="num text-foreground">{Math.round((micro / total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${(micro / total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="By risk band">
            <ul className="space-y-2.5">
              {(["LOW", "MEDIUM", "HIGH"] as const).map((b) => {
                const micro = Number(p.by_risk[b] ?? 0);
                return (
                  <li key={b} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{RISK[b].label}</span>
                      <span className="num text-foreground">{Math.round((micro / total) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary"><div className={`h-full rounded-full ${RISK[b].bar}`} style={{ width: `${(micro / total) * 100}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      <Panel title="Positions">
        {p && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No positions yet. <Link to="/app/investor/opportunities" className="text-info hover:underline">Browse opportunities →</Link></p>
        )}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Opportunity</th>
                <th className="py-2 pr-4 text-right font-medium">Invested</th>
                <th className="py-2 pr-4 text-right font-medium">Share</th>
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 text-right font-medium">Repaid</th>
                <th className="py-2 pr-4 text-right font-medium">EVC</th>
                <th className="py-2 font-medium"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const state = positionState(r);
                const to = `/app/investor/positions/${r.investment_id}`;
                // The whole row answers a click; the title is the real link, for
                // the keyboard and for screen readers.
                return (
                  <tr key={r.investment_id} className="cursor-pointer hover:bg-secondary/40" onClick={() => navigate(to)}>
                    <td className="py-3 pr-4">
                      <Link to={to} onClick={(e) => e.stopPropagation()}
                        className="block font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none">
                        {title(r.purpose, r.business_sector)}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                      {r.is_simulated && <span className="ml-2 text-xs text-caution">simulated</span>}
                    </td>
                    <td className="num py-3 pr-4 text-right text-foreground">{usdc(r.amount_micro_usdc)}</td>
                    <td className="num py-3 pr-4 text-right text-muted-foreground">{(r.share_bps / 100).toFixed(1)}%</td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      {r.loan_status && ["ACTIVE", "PAID"].includes(r.loan_status) && (
                        <span className="num ml-2 text-xs text-muted-foreground">{r.paid}/{r.term_months}</span>
                      )}
                    </td>
                    <td className="num py-3 pr-4 text-right text-positive">{r.repaid_micro_usdc ? usdc(r.repaid_micro_usdc) : "—"}</td>
                    <td className="num py-3 pr-4 text-right text-muted-foreground">{r.evc_cents !== null ? money(r.evc_cents) : "—"}</td>
                    <td className="py-3 text-right text-muted-foreground"><ChevronRight size={16} aria-hidden /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
