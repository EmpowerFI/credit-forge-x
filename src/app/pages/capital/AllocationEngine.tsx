import { useEffect, useMemo, useRef, useState } from "react";
import { allocate, type AllocationResult, type PoolPolicy } from "@empowerfi/capital-allocation";
import { FastForward, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import StatusPill from "../../components/product/StatusPill";
import { localized, tr } from "../../i18n";
import { prototypeNotice } from "../../lib/capital";
import { creditSteps, type CreditStep, type EngineOpportunity, type EngineState, runPlan, stateAt } from "../../lib/engine";
import CapitalPools from "../investor/CapitalPools";
import { useCapitalOverview } from "../investor/queries";
import Assumptions from "./engine/Assumptions";
import { formFor, type PoolForm, policyOf } from "./engine/pools";
import CreditEngine from "./engine/CreditEngine";
import Decision from "./engine/Decision";
import OpportunityPicker from "./engine/OpportunityPicker";
import { EngineHeader, Flow } from "./engine/parts";
import PoolBranch from "./engine/PoolBranch";
import Replay from "./engine/Replay";
import Snapshot from "./engine/Snapshot";
import TwoEngines from "./engine/TwoEngines";
import { useEngineRun } from "./engine/useEngineRun";
import VerifyDecision from "./engine/VerifyDecision";
import { useEngineOpportunities } from "./queries";

// The Credit Engine page: pick a qualified opportunity, run both engines, and
// watch the decision form. Engine 1 shows the recorded readiness and
// eligibility; Engine 2 re-runs the allocation engine in this browser against
// today's liquidity and the assumptions in the drawer. Nothing here writes: the
// database allocates when an opportunity opens to investors.

const STATE_LABEL: Record<EngineState, string> = localized({
  IDLE: { en: "Idle", pt: "Parado" },
  OPPORTUNITY_SELECTED: { en: "Opportunity selected", pt: "Oportunidade selecionada" },
  RUNNING_CREDIT_ENGINE: { en: "Running the credit engine", pt: "Rodando o motor de crédito" },
  CREDIT_REJECTED: { en: "Not qualified", pt: "Não qualificada" },
  RUNNING_CAPITAL_ALLOCATION: { en: "Running capital allocation", pt: "Rodando a alocação de capital" },
  DOMESTIC_SELECTED: { en: "Domestic P2P selected", pt: "P2P Doméstico escolhido" },
  GLOBAL_SELECTED: { en: "Global P2P selected", pt: "P2P Global escolhido" },
  WAITING_FOR_CAPITAL: { en: "Waiting for capital", pt: "Aguardando capital" },
  ERROR: { en: "Error", pt: "Erro" },
});

const STATE_TONE: Record<EngineState, "neutral" | "info" | "caution" | "positive" | "alert"> = {
  IDLE: "neutral", OPPORTUNITY_SELECTED: "info", RUNNING_CREDIT_ENGINE: "info", CREDIT_REJECTED: "caution",
  RUNNING_CAPITAL_ALLOCATION: "info", DOMESTIC_SELECTED: "positive", GLOBAL_SELECTED: "positive", WAITING_FOR_CAPITAL: "caution", ERROR: "alert",
};

interface Run {
  o: EngineOpportunity;
  steps: CreditStep[];
  result: AllocationResult | null;
  policies: { domestic: PoolPolicy; global: PoolPolicy };
  globalMicroUsdc: number;
  plan: ReturnType<typeof runPlan>;
}

export default function AllocationEngine() {
  const overview = useCapitalOverview();
  const opportunities = useEngineOpportunities();
  const [domestic, setDomestic] = useState<PoolForm | null>(null);
  const [global, setGlobal] = useState<PoolForm | null>(null);
  const [selected, setSelected] = useState<EngineOpportunity | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const clock = useEngineRun();
  const canvas = useRef<HTMLDivElement>(null);

  const dbForms = useMemo(() => {
    const d = overview.data?.pools.find((p) => p.pool === "domestic");
    const g = overview.data?.pools.find((p) => p.pool === "global");
    return d && g ? { domestic: formFor(d), global: formFor(g) } : null;
  }, [overview.data]);

  useEffect(() => {
    if (!dbForms || domestic) return;
    setDomestic(dbForms.domestic);
    setGlobal(dbForms.global);
  }, [dbForms, domestic]);

  if (overview.isError) return <LoadError error={overview.error} onRetry={() => overview.refetch()} />;
  if (opportunities.isError) return <LoadError error={opportunities.error} onRetry={() => opportunities.refetch()} />;

  const fx = overview.data?.fx_brl_per_usdc_milli ?? 5400;
  const policies = domestic && global ? { domestic: policyOf("domestic", domestic, fx), global: policyOf("global", global, fx) } : null;
  const changed = Boolean(dbForms && domestic && global
    && (JSON.stringify(dbForms.domestic) !== JSON.stringify(domestic) || JSON.stringify(dbForms.global) !== JSON.stringify(global)));

  const select = (o: EngineOpportunity) => {
    clock.reset();
    setRun(null);
    setSelected(o);
  };

  const start = () => {
    if (!selected || !policies || !global) return;
    const steps = creditSteps(selected);
    const qualified = steps.every((s) => s.passed);
    const result = qualified
      ? allocate({
        amount_cents: selected.amount_cents, term_months: selected.term_months, risk_band: selected.risk_band,
        purpose: selected.purpose, impact_eligible: selected.impact_eligible,
      }, policies.domestic, policies.global)
      : null;
    const plan = runPlan(steps, result);
    setRun({ o: selected, steps, result, policies, globalMicroUsdc: Math.round(Number(global.available) * 1e6), plan });
    clock.start(plan.total);
    if (window.innerWidth < 1024) window.setTimeout(() => canvas.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const state: EngineState = !selected ? "IDLE" : !run ? "OPPORTUNITY_SELECTED" : stateAt(clock.tick, run.plan, run.result);
  const running = state === "RUNNING_CREDIT_ENGINE" || state === "RUNNING_CAPITAL_ALLOCATION";
  const activeEngine: 0 | 1 | 2 = state === "RUNNING_CREDIT_ENGINE" || state === "CREDIT_REJECTED" ? 1
    : state === "IDLE" || state === "OPPORTUNITY_SELECTED" ? 0 : 2;
  const poolBase = run ? run.plan.creditTicks + 1 : 0;
  const economicsBase = run ? poolBase + run.plan.poolTicks : 0;
  const showAllocation = Boolean(run?.result && clock.tick >= run.plan.creditTicks);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={tr({ en: "Two engines, one decision", pt: "Dois motores, uma decisão" })} title={tr({ en: "Credit Engine", pt: "Motor de Crédito" })}
        description={tr({
          en: "EmpowerFI first decides whether a business is credit-ready, then which available pool of P2P capital can fund it sustainably. Pick a qualified opportunity and run both engines.",
          pt: "A EmpowerFI primeiro decide se um negócio está pronto para crédito, depois qual pool de capital P2P disponível pode financiá-lo de forma sustentável. Escolha uma oportunidade qualificada e rode os dois motores.",
        })} />

      <CapitalPools engineLink={false} tilesOnly />

      <TwoEngines active={activeEngine} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Controls */}
        <div className="panel h-fit space-y-4 p-5 lg:sticky lg:top-20">
          <p className="font-heading text-base font-bold text-foreground">{tr({ en: "Select a qualified opportunity", pt: "Selecione uma oportunidade qualificada" })}</p>
          {!opportunities.data || !policies ? <Skeleton className="h-16 w-full rounded-xl" /> : (
            <OpportunityPicker options={opportunities.data} value={selected} onChange={select} disabled={running} />
          )}
          {selected && <Snapshot o={selected} />}
          <Button size="lg" onClick={start} disabled={!selected || !policies || running}
            className="h-12 w-full gap-2 bg-accent text-base font-bold tracking-wide text-accent-foreground hover:bg-accent/90">
            {run && !running ? <RotateCcw size={18} /> : <Play size={18} />}
            {run && !running ? tr({ en: "Run again", pt: "Rodar de novo" }) : tr({ en: "RUN CREDIT ENGINE", pt: "RODAR O MOTOR DE CRÉDITO" })}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill tone={STATE_TONE[state]} dot={running}>{STATE_LABEL[state]}</StatusPill>
            {running && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={clock.skip}><FastForward size={14} /> {tr({ en: "Skip animation", pt: "Pular animação" })}</Button>
            )}
          </div>
          {domestic && global && (
            <div className="border-t border-border pt-4">
              <Assumptions domestic={domestic} global={global} onDomestic={setDomestic} onGlobal={setGlobal} changed={changed}
                onReset={() => { if (dbForms) { setDomestic(dbForms.domestic); setGlobal(dbForms.global); } }} />
              <p className="mt-2 text-xs text-muted-foreground">{tr({
                en: "Runs against today's liquidity and policies. Analysis only: the database records an allocation when an opportunity opens to investors.",
                pt: "Roda com a liquidez e as políticas de hoje. Só análise: o banco de dados registra a alocação quando a oportunidade abre para investidores.",
              })}</p>
            </div>
          )}
        </div>

        {/* The decision canvas */}
        <div ref={canvas} className="panel min-h-[28rem] scroll-mt-20 space-y-6 p-5 sm:p-6">
          {!run ? (
            <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
              <p className="font-heading text-lg font-bold text-foreground">
                {selected
                  ? tr({ en: `${selected.code} is ready to run`, pt: `${selected.code} está pronta para rodar` })
                  : tr({ en: "The decision appears here", pt: "A decisão aparece aqui" })}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {selected
                  ? tr({ en: "Run the credit engine to watch readiness and eligibility, then both pools, decide where its capital comes from.", pt: "Rode o motor de crédito para ver a prontidão e a elegibilidade, e depois os dois pools, decidirem de onde vem o capital." })
                  : tr({ en: "Select a qualified opportunity, then run the credit engine.", pt: "Selecione uma oportunidade qualificada e rode o motor de crédito." })}
              </p>
            </div>
          ) : (
            <>
              <CreditEngine o={run.o} steps={run.steps} tick={clock.tick} />

              {showAllocation && run.result && (
                <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300" aria-live="polite">
                  <EngineHeader n={2} name={tr({ en: "Capital Allocation Engine", pt: "Motor de Alocação de Capital" })}
                    question={tr({ en: "Which available pool should fund it?", pt: "Qual pool disponível deve financiá-la?" })}
                    right={<span className="text-xs text-muted-foreground">{run.result.model_version}</span>} />
                  <div aria-hidden className="hidden px-[25%] md:block">
                    <Flow active={clock.tick > run.plan.creditTicks} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(["domestic", "global"] as const).map((pool) => (
                      <PoolBranch key={pool} pool={pool} result={run.result!} policy={run.policies[pool]} tick={clock.tick}
                        base={poolBase} economicsBase={economicsBase} liquidityMicroUsdc={pool === "global" ? run.globalMicroUsdc : null}
                        chosen={run.result!.pool === pool} done={clock.done} impactEligible={run.o.impact_eligible} />
                    ))}
                  </div>
                  <Flow vertical active={clock.done} />
                </section>
              )}

              {clock.done && (
                <div className="space-y-4">
                  <Decision o={run.o} steps={run.steps} result={run.result} policies={run.policies} fxMilli={fx} />
                  {!run.plan.rejected && <VerifyDecision o={run.o} route={run.result?.pool ?? null} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {overview.data && policies && (
        <Replay demand={overview.data.demand} policies={policies} coverage={overview.data.coverage} assumptionsChanged={changed} />
      )}

      <p className="px-1 text-xs text-muted-foreground">{prototypeNotice()}</p>
    </div>
  );
}
