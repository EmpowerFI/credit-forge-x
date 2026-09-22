import { useMemo } from "react";
import { allocatePortfolio, type AllocationOpportunity, type PoolPolicy } from "@empowerfi/capital-allocation";
import { FastForward, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Panel from "../../../components/product/Panel";
import PoolPill from "../../../components/product/PoolPill";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { bpsPercent, type CapitalOverview, poolCapacityNote, POOL } from "../../../lib/capital";
import { money } from "../../../lib/readiness";
import { bandLetter } from "./labels";
import { useEngineRun } from "./useEngineRun";

/**
 * Today's allocation, replayed: every qualified opportunity not yet lent, in
 * the order it came, through the same engine, each drawing down the pool it
 * gets. The same replay the database runs for its coverage figures.
 */
export default function Replay({ demand, policies, coverage, assumptionsChanged }: {
  demand: CapitalOverview["demand"];
  policies: { domestic: PoolPolicy; global: PoolPolicy };
  coverage: CapitalOverview["coverage"];
  assumptionsChanged: boolean;
}) {
  const clock = useEngineRun();
  const ops: AllocationOpportunity[] = demand.map((o) => ({
    amount_cents: o.amount_cents, term_months: o.term_months, risk_band: o.risk_band, purpose: o.purpose, impact_eligible: o.impact_eligible,
  }));
  const replay = useMemo(() => allocatePortfolio(ops, policies.domestic, policies.global),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(ops), JSON.stringify(policies)]);

  // Running totals after each opportunity.
  const trail = useMemo(() => {
    let d = policies.domestic.available_cents;
    let g = policies.global.available_cents;
    let funded = 0;
    return replay.results.map((r, i) => {
      if (r.pool === "domestic") d -= ops[i].amount_cents;
      if (r.pool === "global") g -= ops[i].amount_cents;
      if (r.pool) funded += ops[i].amount_cents;
      return { d, g, funded };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  const shown = clock.started ? Math.min(clock.tick, demand.length) : 0;
  const now = shown > 0 ? trail[shown - 1] : { d: policies.domestic.available_cents, g: policies.global.available_cents, funded: 0 };
  const evaluated = demand.slice(0, shown).reduce((n, o) => n + o.amount_cents, 0);
  const gap = evaluated - now.funded;
  const coverageBps = evaluated > 0 ? Math.floor((now.funded * 10_000) / evaluated) : 0;
  const finished = clock.started && shown >= demand.length;
  const matches = replay.combined_cents === coverage.combined_cents && replay.domestic_only_cents === coverage.domestic_only_cents;

  const bar = (left: number, start: number, pool: "domestic" | "global") => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{POOL[pool].name}</span>
        <span className="num text-muted-foreground">{money(left)} / {money(start)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none", POOL[pool].bar)}
          style={{ width: `${start > 0 ? Math.max(0, (left / start) * 100) : 0}%` }} />
      </div>
    </div>
  );

  return (
    <Panel title={tr({ en: "Today's allocation, replayed", pt: "A alocação de hoje, reprocessada" })}
      description={tr({
        en: "Every qualified opportunity not yet lent, in the order it came, through the same engine: each draws down the capacity of the pool it gets, until a pool has no room left. Nothing is being spent — this asks how far today's declared capital would go.",
        pt: "Cada oportunidade qualificada ainda não emprestada, na ordem em que chegou, pelo mesmo motor: cada uma consome a capacidade do pool que recebe, até um pool ficar sem espaço. Nada está sendo gasto — isto pergunta até onde o capital declarado hoje chegaria.",
      })}
      actions={
        <div className="flex flex-wrap gap-2">
          {clock.started && !clock.done && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={clock.skip}><FastForward size={14} /> {tr({ en: "Skip", pt: "Pular" })}</Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => clock.start(demand.length)} disabled={demand.length === 0 || (clock.started && !clock.done)}>
            {finished ? <RotateCcw size={14} /> : <Play size={14} />}
            {finished ? tr({ en: "Replay again", pt: "Reprocessar de novo" }) : tr({ en: "Replay today's allocation", pt: "Reprocessar a alocação de hoje" })}
          </Button>
        </div>
      }>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          {bar(now.d, policies.domestic.available_cents, "domestic")}
          {bar(now.g, policies.global.available_cents, "global")}
          <p className="text-xs text-muted-foreground">{poolCapacityNote()}</p>
          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Evaluated", pt: "Avaliadas" })}</dt><dd className="num font-semibold text-foreground">{shown} / {demand.length}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Fundable", pt: "Financiável" })}</dt><dd className="num font-semibold text-positive">{money(now.funded)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Funding gap", pt: "Lacuna de captação" })}</dt><dd className="num font-semibold text-foreground">{money(gap)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Coverage", pt: "Cobertura" })}</dt><dd className="num font-semibold text-foreground">{bpsPercent(coverageBps)}</dd></div>
          </dl>
        </div>

        <div className="min-w-0">
          {!clock.started ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {tr({ en: `${demand.length} qualified opportunities in the queue. Replay them to watch the pools fill the demand.`, pt: `${demand.length} oportunidades qualificadas na fila. Reprocesse para ver os pools atenderem a demanda.` })}
            </p>
          ) : (
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {demand.slice(0, shown).map((o, i) => {
                const r = replay.results[i];
                return (
                  <li key={o.opportunity_id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="min-w-0">
                      <span className="font-mono font-semibold text-foreground">{o.code}</span>
                      <span className="num ml-2 text-muted-foreground">{money(o.amount_cents)} · {bandLetter(o.risk_band)} · {o.term_months}m</span>
                    </span>
                    {r.pool ? <PoolPill pool={r.pool} /> : <StatusPill tone="caution" dot={false}>{tr({ en: "Waiting", pt: "Aguardando" })}</StatusPill>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {finished && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-background/30 px-4 py-3 text-sm animate-in fade-in duration-300">
          <span><span className="num font-bold text-foreground">{demand.length}</span> {tr({ en: "opportunities evaluated", pt: "oportunidades avaliadas" })}</span>
          <span><span className="num font-bold text-positive">{money(replay.combined_cents)}</span> {tr({ en: "fundable", pt: "financiáveis" })}</span>
          <span><span className="num font-bold text-foreground">{bpsPercent(replay.combined_coverage_bps)}</span> {tr({ en: "funding coverage", pt: "de cobertura" })}</span>
          <span><span className="num font-bold text-caution">{money(replay.demand_cents - replay.combined_cents)}</span> {tr({ en: "waiting for capital", pt: "aguardando capital" })}</span>
          <span className={cn("text-xs", assumptionsChanged ? "text-caution" : matches ? "text-positive" : "text-caution")}>
            {assumptionsChanged
              ? tr({ en: "With your assumptions, not the database's.", pt: "Com as suas premissas, não as do banco de dados." })
              : matches
                ? tr({ en: "Matches the database's own replay.", pt: "Igual ao reprocessamento do próprio banco de dados." })
                : tr({ en: "Differs from the database's replay.", pt: "Diferente do reprocessamento do banco de dados." })}
          </span>
        </div>
      )}
    </Panel>
  );
}
