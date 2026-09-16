import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSelectedWalletAccount } from "@solana/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { useAuth } from "../../auth/useAuth";
import { percent } from "../../lib/credit";
import { poolOf } from "../../lib/capital";
import { ACTIVITY_LABEL, type Grade, RISK, title } from "../../lib/investor";
import { PURPOSE_LABEL } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { useBalances } from "../../wallet/useBalances";
import CapitalPools from "./CapitalPools";
import FundingBar from "./FundingBar";
import { useActivity, useMarket, usePortfolio } from "./queries";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export default function Overview() {
  const { profile } = useAuth();
  const [account] = useSelectedWalletAccount();
  const wallet = profile?.wallet_address ?? null;
  const connected = Boolean(account && wallet && account.address === wallet);
  const balances = useBalances(connected ? wallet : null);
  const portfolio = usePortfolio();
  const activity = useActivity(200);
  const market = useMarket();

  // Capital invested and repaid, cumulative, day by day.
  const series = useMemo(() => {
    const events = [...(activity.data ?? [])]
      .filter((e) => e.kind === "invested" || e.kind === "repayment")
      .sort((a, b) => a.at.localeCompare(b.at));
    let invested = 0, repaid = 0;
    const points = new Map<string, { day: string; invested: number; repaid: number }>();
    for (const e of events) {
      if (e.kind === "invested") invested += Number(e.micro_usdc ?? 0) / 1e6;
      else repaid += Number(e.micro_usdc ?? 0) / 1e6;
      points.set(e.at.slice(0, 10), { day: day(e.at), invested: Math.round(invested * 100) / 100, repaid: Math.round(repaid * 100) / 100 });
    }
    return [...points.values()];
  }, [activity.data]);

  if (portfolio.isError) return <LoadError error={portfolio.error} onRetry={() => portfolio.refetch()} />;
  const p = portfolio.data;
  const gain = p && p.invested_micro_usdc > 0 ? Math.round(((p.expected_micro_usdc - p.invested_micro_usdc) / p.invested_micro_usdc) * 10000) : null;
  const byRisk = (["LOW", "MEDIUM", "HIGH"] as Grade[]).map((b) => ({ band: b, micro: Number(p?.by_risk[b] ?? 0) }));
  const riskTotal = Math.max(1, byRisk.reduce((s, r) => s + r.micro, 0));
  const raising = (market.data ?? []).filter((o) => o.funding_status === "open" || o.funding_status === "partially_funded").slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="P2P capital console" title="Overview"
        description="Qualified productive-credit demand, and the two pools of P2P capital that fund it: domestic investors in reais, and global investors in USDC on Solana. She receives and repays in reais, by Pix, either way." />

      <CapitalPools />

      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">Your capital</h2>
        <p className="text-xs text-muted-foreground">
          {wallet ? "Global positions from your wallet on Solana devnet; domestic positions in reais, simulated." : "Exploring as the demo investor: simulated positions, no wallet. Sign in with your own wallet to invest in USDC."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {p ? (
          <>
            <StatTile label="Invested" value={usdc(p.invested_micro_usdc)} hint={`${p.positions} positions`} />
            <StatTile label="Deployed to businesses" value={usdc(p.deployed_micro_usdc)}
              hint={p.invested_micro_usdc ? `${Math.round((p.deployed_micro_usdc / p.invested_micro_usdc) * 100)}%` : undefined} />
            <StatTile label="Available USDC" value={connected && balances.data ? usdc(balances.data.microUsdc) : "—"}
              hint={wallet ? (connected ? "in your wallet" : "reconnect wallet") : "demo mode"} />
            <StatTile label="Repaid to you" value={usdc(p.repaid_micro_usdc)} hintTone="positive" hint="your share of instalments" />
            <StatTile label="Expected back · demo" value={usdc(p.expected_micro_usdc)} hintTone="positive"
              hint={gain !== null ? `+${percent(gain)} on invested` : undefined} />
          </>
        ) : [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-card" />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Capital over time" description="Cumulative USDC invested and repaid to you.">
          {series.length > 1 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }} formatter={(v: number, k: string) => [`${v.toLocaleString("en-US")} USDC`, k === "invested" ? "Invested" : "Repaid"]} />
                  <Area type="monotone" dataKey="invested" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#inv)" />
                  <Area type="monotone" dataKey="repaid" stroke="hsl(var(--positive))" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your first investment starts the curve.</p>
          )}
        </Panel>

        <Panel title="Allocation by risk band">
          <ul className="space-y-4">
            {byRisk.map(({ band, micro }) => (
              <li key={band} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{RISK[band].label}</span>
                  <span className="num text-muted-foreground">{Math.round((micro / riskTotal) * 100)}% · {usdc(micro, 0)}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className={`h-full rounded-full ${RISK[band].bar}`} style={{ width: `${(micro / riskTotal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">EmpowerFI's band at eligibility, which each pool's risk appetite is checked against.</p>
        </Panel>
      </div>

      <Panel title="Recent activity" actions={<Link to="/app/investor/portfolio" className="text-sm text-info hover:underline">Portfolio →</Link>}>
        {activity.isPending && <Skeleton className="h-40 rounded-xl bg-secondary" />}
        {activity.isError && <LoadError compact error={activity.error} onRetry={() => activity.refetch()} />}
        {activity.data && activity.data.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <tbody className="divide-y divide-border">
              {(activity.data ?? []).slice(0, 8).map((e) => (
                <tr key={`${e.kind}-${e.entity_id ?? e.investment_id}-${e.at}`}>
                  <td className="py-3 pr-4 font-medium text-foreground">{ACTIVITY_LABEL[e.kind] ?? e.kind}</td>
                  <td className="py-3 pr-4 text-muted-foreground"><span className="font-mono">{e.code}</span> · {PURPOSE_LABEL[e.purpose]}</td>
                  <td className="num py-3 pr-4 text-right text-foreground">
                    {e.micro_usdc !== null ? `${e.kind === "repayment" ? "+" : ""}${usdc(e.micro_usdc)}` : "—"}
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{day(e.at)}</td>
                  <td className="py-3 text-right">
                    {e.signature ? <ExplorerLink tx={e.signature} label="Confirmed" /> : e.entity_kind && e.entity_id ? (
                      <Link to={`/app/audit/${e.entity_kind}/${e.entity_id}`} className="inline-flex items-center gap-1 text-xs text-positive hover:underline">
                        <BadgeCheck size={13} /> Verify
                      </Link>
                    ) : <StatusPill tone="caution">Due</StatusPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Raising now" actions={<Link to="/app/investor/opportunities" className="text-sm text-info hover:underline">All opportunities →</Link>}>
        <ul className="grid gap-4 md:grid-cols-3">
          {raising.map((o) => (
            <li key={o.opportunity_id} className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
              <div className="space-y-1">
                <PoolPill pool={poolOf(o.funding_pool)} />
                <p className="font-medium text-foreground">{title(o.purpose, o.business_sector)}</p>
                <p className="text-xs text-muted-foreground">Risk {RISK[o.risk_band].grade} · {o.term_months} mo · {percent(o.indicative_yield_bps)} simulated</p>
              </div>
              <FundingBar funded={o.funded_micro_usdc} target={o.funding_target_micro_usdc} compact pool={poolOf(o.funding_pool)}
                fxMilli={o.fx_brl_per_usdc_milli} amountCents={o.amount_cents} />
              <Button asChild size="sm" variant="secondary" className="w-full gap-2">
                <Link to={`/app/investor/opportunities/${o.opportunity_id}`}>View <ArrowRight size={14} /></Link>
              </Button>
            </li>
          ))}
          {market.data && raising.length === 0 && <li className="text-sm text-muted-foreground">Nothing raising right now.</li>}
        </ul>
      </Panel>
    </div>
  );
}
