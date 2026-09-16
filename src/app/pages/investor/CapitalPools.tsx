import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { bpsPercent, POOL, reaisShort, usdcShort } from "../../lib/capital";
import { money } from "../../lib/readiness";
import { REALITY } from "../../lib/settlement";
import { useCapitalOverview } from "./queries";

/**
 * Qualified demand against the two pools of P2P capital: what domestic capital
 * alone would cover, and what domestic and global capital cover together.
 */
export default function CapitalPools({ engineLink = true }: { engineLink?: boolean }) {
  const q = useCapitalOverview();
  if (q.isError) return <LoadError compact error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const domestic = d?.pools.find((p) => p.pool === "domestic");
  const global = d?.pools.find((p) => p.pool === "global");
  const bar = (bps: number, cls: string, label: string) => (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
      <span className="truncate font-medium text-foreground">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={label}
        aria-valuenow={Math.round(bps / 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, bps / 100)}%` }} />
      </div>
      <span className="num w-16 text-right text-muted-foreground">{bpsPercent(bps)}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d && domestic && global ? (
          <>
            <StatTile label="Qualified demand" value={reaisShort(d.coverage.demand_cents)} hint={`${d.demand.length} opportunities`} />
            <StatTile label="Domestic liquidity" value={reaisShort(domestic.liquidity_cents)} hint="simulated BRL pool" />
            <StatTile label="Global liquidity" value={usdcShort(global.liquidity_micro_usdc ?? 0)} hint={`≈ ${reaisShort(global.liquidity_cents)}`} />
            <StatTile label="Funding coverage" value={bpsPercent(d.coverage.combined_coverage_bps)}
              hint={`${bpsPercent(d.coverage.domestic_coverage_bps)} domestic alone`} hintTone="info" />
          </>
        ) : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-card" />)}
      </div>

      <Panel title="Capital availability"
        description="How much qualified demand each pool can fund: the allocation engine replayed over every opportunity not yet lent, in the order they came."
        actions={engineLink ? <Link to="/app/capital" className="text-sm text-info hover:underline">Capital Allocation Engine →</Link> : undefined}>
        {!d ? <Skeleton className="h-16 w-full" /> : (
          <div className="space-y-3">
            {bar(d.coverage.domestic_coverage_bps, POOL.domestic.bar, "Domestic P2P")}
            {bar(d.coverage.combined_coverage_bps, POOL.global.bar, "Domestic + Global")}
            <p className="text-xs text-muted-foreground">
              Of {money(d.coverage.demand_cents)} qualified, domestic capital alone covers {money(d.coverage.domestic_only_cents)};
              with global capital, {money(d.coverage.combined_cents)}. A pool can be cheaper and still unavailable: global capital
              funds what a specific domestic pool has no liquidity, mandate or risk appetite for.
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border tone-caution px-3 py-2 text-xs">
              <span className="font-semibold">Routing principle:</span>
              <span>choose between domestic P2P and global USDC by cost, availability, mandate and risk appetite.</span>
              <StatusPill tone={REALITY.simulated.tone} dot={false}>Pools {REALITY.simulated.label.toLowerCase()}</StatusPill>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
