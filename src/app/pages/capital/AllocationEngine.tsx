import { useEffect, useMemo, useRef, useState } from "react";
import { allocate, type AllocationResult, type PoolPolicy } from "@empowerfi/capital-allocation";
import { ArrowDown, BarChart3, FastForward, Play, RotateCcw, Split } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../auth/useAuth";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import StatusPill from "../../components/product/StatusPill";
import { localized, tr } from "../../i18n";
import { prototypeNotice } from "../../lib/capital";
import { compareForOpportunity } from "../../lib/settlementRoute";
import { creditSteps, type CreditStep, type EngineOpportunity, type EngineState, runPlan, stateAt } from "../../lib/engine";
import CapitalPools from "../investor/CapitalPools";
import { useCapitalOverview } from "../investor/queries";
import Assumptions from "./engine/Assumptions";
import { formFor, type PoolForm, policyOf } from "./engine/pools";
import CreditEngine from "./engine/CreditEngine";
import Decision from "./engine/Decision";
import Economics from "./engine/Economics";
import OpportunityPicker from "./engine/OpportunityPicker";
import { EngineHeader, Flow } from "./engine/parts";
import PoolBranch from "./engine/PoolBranch";
import Replay from "./engine/Replay";
import Snapshot from "./engine/Snapshot";
import TwoEngines from "./engine/TwoEngines";
import { useEngineRun } from "./engine/useEngineRun";
import VerifyDecision from "./engine/VerifyDecision";
import { useEngineOpportunities, useRouteCards } from "./queries";

// The Credit & Capital Engine page: pick a qualified opportunity, run the credit
// engine, then capital allocation on what it qualified, and watch the decision
// form. Engine 1 shows the recorded readiness and
// eligibility; Engine 2 re-runs the allocation engine in this browser against
// today's liquidity and the assumptions in the drawer. Nothing here writes: the
// database allocates when an opportunity opens to investors.

const STATE_LABEL: Record<EngineState, string> = localized({
  IDLE: { en: "Ready to run", pt: "Pronto para rodar" },
  OPPORTUNITY_SELECTED: { en: "Opportunity selected", pt: "Oportunidade selecionada" },
  RUNNING_CREDIT_ENGINE: { en: "Running the credit engine", pt: "Rodando o motor de crédito" },
  CREDIT_REJECTED: { en: "Not qualified", pt: "Não qualificada" },
  QUALIFIED_OPPORTUNITY: { en: "Qualified credit opportunity", pt: "Oportunidade de crédito qualificada" },
  RUNNING_CAPITAL_ALLOCATION: { en: "Running capital allocation", pt: "Rodando a alocação de capital" },
  DOMESTIC_SELECTED: { en: "Domestic P2P selected", pt: "P2P Doméstico escolhido" },
  GLOBAL_SELECTED: { en: "Global P2P selected", pt: "P2P Global escolhido" },
  WAITING_FOR_CAPITAL: { en: "Waiting for capital", pt: "Aguardando capital" },
  ERROR: { en: "Error", pt: "Erro" },
});

const STATE_TONE: Record<EngineState, "neutral" | "info" | "caution" | "positive" | "alert"> = {
  IDLE: "neutral", OPPORTUNITY_SELECTED: "info", RUNNING_CREDIT_ENGINE: "info", CREDIT_REJECTED: "caution", QUALIFIED_OPPORTUNITY: "positive",
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
  const { profile } = useAuth();
  const overview = useCapitalOverview();
  const opportunities = useEngineOpportunities();
  const cards = useRouteCards();
  const [domestic, setDomestic] = useState<PoolForm | null>(null);
  const [global, setGlobal] = useState<PoolForm | null>(null);
  const [selected, setSelected] = useState<EngineOpportunity | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const clock = useEngineRun();
  const canvas = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const requested = params.get("opportunity");

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

  // Opened from Impact Intelligence with an opportunity's code: it comes selected.
  useEffect(() => {
    if (!requested || selected || !opportunities.data) return;
    const match = opportunities.data.find((o) => o.code === requested);
    if (match) setSelected(match);
  }, [requested, selected, opportunities.data]);

  if (overview.isError) return <LoadError error={overview.error} onRetry={() => overview.refetch()} />;
  if (opportunities.isError) return <LoadError error={opportunities.error} onRetry={() => opportunities.refetch()} />;

  const fx = overview.data?.fx_brl_per_usdc_milli ?? 5400;
  // Settlement is priced here too, from the database's own rate cards: the
  // engine page runs every engine in the browser and writes nothing.
  const settlement = run?.result?.pool === "global" && cards.data
    ? compareForOpportunity(cards.data, run.o, fx)
    : null;
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
    // The credit engine first; capital allocation runs on what it qualified, when asked.
    clock.start(plan.total, plan.rejected ? null : plan.creditTicks + 1);
    if (window.innerWidth < 1024) window.setTimeout(() => canvas.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const state: EngineState = !selected ? "IDLE" : !run ? "OPPORTUNITY_SELECTED"
    : clock.held ? "QUALIFIED_OPPORTUNITY" : stateAt(clock.tick, run.plan, run.result);
  const running = state === "RUNNING_CREDIT_ENGINE" || state === "RUNNING_CAPITAL_ALLOCATION";
  const activeEngine: 0 | 1 | 2 = state === "RUNNING_CREDIT_ENGINE" || state === "CREDIT_REJECTED" || state === "QUALIFIED_OPPORTUNITY" ? 1
    : state === "IDLE" || state === "OPPORTUNITY_SELECTED" ? 0 : 2;
  const poolBase = run ? run.plan.creditTicks + 1 : 0;
  const economicsBase = run ? poolBase + run.plan.poolTicks : 0;
  const showAllocation = Boolean(run?.result && !clock.holding && clock.tick >= run.plan.creditTicks + 1);
  const allocate_ = () => {
    clock.resume();
    if (window.innerWidth < 1024) window.setTimeout(() => canvas.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={tr({ en: "Two engines, one decision", pt: "Dois motores, uma decisão" })} title={tr({ en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" })}
        description={tr({
          en: "Pick an opportunity, run the credit engine, then run capital allocation on what it qualifies.",
          pt: "Escolha uma oportunidade, rode o motor de crédito e depois a alocação de capital sobre o que ele qualificar.",
        })}
        about={tr({
          en: (
            <>
              <p>Engine 1 asks whether a business should become a qualified credit opportunity, from its readiness, its history, affordability and risk. Engine 2 asks which available pool can fund that opportunity sustainably, on liquidity, ticket, risk appetite, mandate and economics — and answers domestic, global, or waiting for capital.</p>
              <p>Both run here in your browser against today's liquidity and the assumptions in the drawer, with the same code the database runs. Nothing on this page writes: the database allocates when an opportunity opens to investors.</p>
              <p>Liquidity here is declared capacity, not money held. EmpowerFI custodies nothing: a pool is what capital has said it will lend through this desk, less what is already lent, and it exists so engine 2 can answer "waiting for capital" instead of assuming there is always more. An investor's money moves when she funds one named opportunity, into the vault, not into a pool.</p>
            </>
          ),
          pt: (
            <>
              <p>O Motor 1 pergunta se um negócio deve virar uma oportunidade de crédito qualificada, a partir da prontidão, do histórico, da capacidade de pagamento e do risco. O Motor 2 pergunta qual pool disponível pode financiá-la de forma sustentável, por liquidez, ticket, apetite a risco, mandato e economia — e responde doméstico, global ou aguardando capital.</p>
              <p>Os dois rodam aqui no seu navegador, com a liquidez de hoje e as premissas da gaveta, usando o mesmo código que roda no banco. Nada nesta página escreve: o banco aloca quando uma oportunidade abre para investidores.</p>
              <p>Liquidez aqui é capacidade declarada, não dinheiro guardado. A EmpowerFI não custodia nada: um pool é o quanto o capital disse que empresta por esta mesa, menos o que já está emprestado, e existe para que o Motor 2 possa responder "aguardando capital" em vez de supor que sempre há mais. O dinheiro da investidora se move quando ela financia uma oportunidade específica, para o cofre, não para um pool.</p>
            </>
          ),
        })}
        actions={profile && ["sponsor", "partner", "admin", "auditor"].includes(profile.role) ? (
          <Button asChild variant="outline" className="gap-2">
            <Link to="/app/capital/economics"><BarChart3 size={16} /> {tr({ en: "Operating economics", pt: "Economia operacional" })}</Link>
          </Button>
        ) : undefined} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Controls */}
        <div className="panel h-fit space-y-4 p-5 lg:sticky lg:top-20">
          <p className="font-heading text-base font-bold text-foreground">{tr({ en: "Select a qualified opportunity", pt: "Selecione uma oportunidade qualificada" })}</p>
          {!opportunities.data || !policies ? <Skeleton className="h-16 w-full rounded-xl" /> : (
            <OpportunityPicker options={opportunities.data} value={selected} onChange={select} disabled={running} />
          )}
          {selected && <Snapshot o={selected} />}
          {clock.held ? (
            <Button size="lg" onClick={allocate_}
              className="h-12 w-full gap-2 bg-accent text-base font-bold tracking-wide text-accent-foreground hover:bg-accent/90">
              <Split size={18} /> {tr({ en: "RUN CAPITAL ALLOCATION", pt: "RODAR A ALOCAÇÃO DE CAPITAL" })}
            </Button>
          ) : (
            <Button size="lg" onClick={start} disabled={!selected || !policies || running}
              className="h-12 w-full gap-2 bg-accent text-base font-bold tracking-wide text-accent-foreground hover:bg-accent/90">
              {run && !running ? <RotateCcw size={18} /> : <Play size={18} />}
              {run && !running ? tr({ en: "Run again", pt: "Rodar de novo" }) : tr({ en: "RUN CREDIT ENGINE", pt: "RODAR O MOTOR DE CRÉDITO" })}
            </Button>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill tone={STATE_TONE[state]} dot={running}>{STATE_LABEL[state]}</StatusPill>
            {running && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={clock.skip}><FastForward size={14} /> {tr({ en: "Skip animation", pt: "Pular animação" })}</Button>
            )}
          </div>
          {domestic && global && (
            <div id="assumptions" className="scroll-mt-32 border-t border-border pt-4">
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

              {clock.held && (
                <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                  <ArrowDown size={16} className="text-accent" aria-hidden />
                  <Button size="lg" onClick={allocate_} className="gap-2 bg-accent font-bold tracking-wide text-accent-foreground hover:bg-accent/90">
                    <Split size={18} /> {tr({ en: "RUN CAPITAL ALLOCATION", pt: "RODAR A ALOCAÇÃO DE CAPITAL" })}
                  </Button>
                  <p className="max-w-md text-center text-xs text-muted-foreground">{tr({
                    en: "Qualified first. Now the Capital Allocation Engine checks liquidity, ticket, risk appetite and mandate in both pools, then compares economics among the ones that can fund it.",
                    pt: "Primeiro a qualificação. Agora o Motor de Alocação de Capital confere liquidez, ticket, apetite a risco e mandato nos dois pools, e compara a economia entre os que podem financiar.",
                  })}</p>
                </div>
              )}

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
                  <Decision o={run.o} steps={run.steps} result={run.result} policies={run.policies} fxMilli={fx} settlement={settlement} />
                  {!run.plan.rejected && <Economics o={run.o} />}
                  {!run.plan.rejected && <VerifyDecision o={run.o} route={run.result?.pool ?? null} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <TwoEngines active={activeEngine} />

      <CapitalPools engineLink={false} tilesOnly />

      {overview.data && policies && (
        <div id="replay" className="scroll-mt-32"><Replay demand={overview.data.demand} policies={policies} coverage={overview.data.coverage} assumptionsChanged={changed} /></div>
      )}

      <p className="px-1 text-xs text-muted-foreground">{prototypeNotice()}</p>
    </div>
  );
}
