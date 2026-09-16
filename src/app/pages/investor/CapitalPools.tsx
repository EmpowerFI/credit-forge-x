import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { tr } from "../../i18n";
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
            <StatTile label={tr({ en: "Qualified demand", pt: "Demanda qualificada" })} value={reaisShort(d.coverage.demand_cents)}
              hint={tr({ en: `${d.demand.length} opportunities`, pt: `${d.demand.length} oportunidades` })} />
            <StatTile label={tr({ en: "Domestic liquidity", pt: "Liquidez doméstica" })} value={reaisShort(domestic.liquidity_cents)}
              hint={tr({ en: "simulated BRL pool", pt: "pool em reais, simulado" })} />
            <StatTile label={tr({ en: "Global liquidity", pt: "Liquidez global" })} value={usdcShort(global.liquidity_micro_usdc ?? 0)} hint={`≈ ${reaisShort(global.liquidity_cents)}`} />
            <StatTile label={tr({ en: "Funding coverage", pt: "Cobertura de captação" })} value={bpsPercent(d.coverage.combined_coverage_bps)}
              hint={tr({ en: `${bpsPercent(d.coverage.domestic_coverage_bps)} domestic alone`, pt: `${bpsPercent(d.coverage.domestic_coverage_bps)} só com o doméstico` })} hintTone="info" />
          </>
        ) : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-card" />)}
      </div>

      <Panel title={tr({ en: "Capital availability", pt: "Capital disponível" })}
        description={tr({
          en: "How much qualified demand each pool can fund: the allocation engine replayed over every opportunity not yet lent, in the order they came.",
          pt: "Quanto da demanda qualificada cada pool consegue captar: o motor de alocação refeito sobre cada oportunidade ainda não emprestada, na ordem em que chegaram.",
        })}
        actions={engineLink ? <Link to="/app/capital" className="text-sm text-info hover:underline">{tr({ en: "Capital Allocation Engine →", pt: "Motor de Alocação de Capital →" })}</Link> : undefined}>
        {!d ? <Skeleton className="h-16 w-full" /> : (
          <div className="space-y-3">
            {bar(d.coverage.domestic_coverage_bps, POOL.domestic.bar, tr({ en: "Domestic P2P", pt: "P2P Doméstico" }))}
            {bar(d.coverage.combined_coverage_bps, POOL.global.bar, tr({ en: "Domestic + Global", pt: "Doméstico + Global" }))}
            <p className="text-xs text-muted-foreground">
              {tr({
                en: <>
                  Of {money(d.coverage.demand_cents)} qualified, domestic capital alone covers {money(d.coverage.domestic_only_cents)};
                  with global capital, {money(d.coverage.combined_cents)}. A pool can be cheaper and still unavailable: global capital
                  funds what a specific domestic pool has no liquidity, mandate or risk appetite for.
                </>,
                pt: <>
                  De {money(d.coverage.demand_cents)} em demanda qualificada, só o capital doméstico cobre {money(d.coverage.domestic_only_cents)};
                  com o capital global, {money(d.coverage.combined_cents)}. Um pool pode ser mais barato e mesmo assim não estar disponível:
                  o capital global financia o que um pool doméstico específico não cobre por falta de liquidez, mandato ou apetite a risco.
                </>,
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border tone-caution px-3 py-2 text-xs">
              <span className="font-semibold">{tr({ en: "Routing principle:", pt: "Princípio de roteamento:" })}</span>
              <span>{tr({
                en: "choose between domestic P2P and global USDC by cost, availability, mandate and risk appetite.",
                pt: "escolher entre P2P doméstico e USDC global por custo, disponibilidade, mandato e apetite a risco.",
              })}</span>
              <StatusPill tone={REALITY.simulated.tone} dot={false}>
                {tr({ en: `Pools ${REALITY.simulated.label.toLowerCase()}`, pt: "Pools simulados" })}
              </StatusPill>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
