import { useEffect, useMemo, useRef, useState } from "react";
import { allocate, type AllocationResult, type PoolPolicy } from "@empowerfi/capital-allocation";
import { ArrowDown, FastForward, Play, RotateCcw, Route, Split } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../auth/useAuth";
import LoadError from "../../components/LoadError";
import PageEvidence from "../../components/product/PageEvidence";
import PageHeader from "../../components/product/PageHeader";
import StatusPill from "../../components/product/StatusPill";
import { localized, tr } from "../../i18n";
import { prototypeNotice } from "../../lib/capital";
import { FOLLOW_TICKS } from "../../lib/capitalJourney";
import { compareForOpportunity } from "../../lib/settlementRoute";
import { creditSteps, type CreditStep, type EngineOpportunity, type EngineState, runPlan, stateAt } from "../../lib/engine";
import { useCapitalOverview } from "../investor/queries";
import Assumptions from "./engine/Assumptions";
import { formFor, type PoolForm, policyOf } from "./engine/pools";
import CreditEngine from "./engine/CreditEngine";
import Decision from "./engine/Decision";
import Economics from "./engine/Economics";
import OpportunityPicker from "./engine/OpportunityPicker";
import FollowCapital from "./engine/FollowCapital";
import { EngineHeader, Flow, RecordHeader } from "./engine/parts";
import PoolBranch from "./engine/PoolBranch";
import Snapshot from "./engine/Snapshot";
import NetworkPlan from "./engine/NetworkPlan";
import { useEngineRun } from "./engine/useEngineRun";
import VerifyDecision from "./engine/VerifyDecision";
import { useJourney } from "./journey/queries";
import { useEngineOpportunities, useRouteCards } from "./queries";

// The Credit & Capital Engine page, in three acts on one canvas: pick a
// qualified opportunity, run the credit engine, run capital allocation on what
// it qualified, then follow the capital the decision released.
//
// Engine 1 shows the recorded readiness and eligibility; Engine 2 re-runs the
// allocation engine in this browser against today's liquidity and the
// assumptions in the drawer. Nothing here writes: the database allocates when
// an opportunity opens to investors.
//
// Three sections used to hang below the canvas: a diagram of the two engines, a
// row of pool liquidity tiles, and a replay of the whole book through the
// engine. The page now has three labelled acts, so the diagram described what
// was already happening above it; the other two are portfolio analytics, which
// is a thing to argue about in a paper rather than to scroll past on the way out
// of a demonstration. All three are still in git.
//
// Act 3 is a different kind of claim and says so. The two engines stop at the
// allocation decision — which is exactly where a conventional impact fund also
// stops, and exactly where this product starts to differ. So the third act
// replays what the ledger recorded for this request: the dollars crossing into
// reais, the disbursal, the money moving inside the territory, and the
// instalment releasing the reais the investor is paid out of. Those four hops
// existed only as a static tally on another screen, which is why the loop was
// legible on no screen at all.

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
  FOLLOWING_CAPITAL: { en: "Following the capital", pt: "Seguindo o capital" },
  LOOP_CLOSED: { en: "The loop, end to end", pt: "O laço, de ponta a ponta" },
  ERROR: { en: "Error", pt: "Erro" },
});

const STATE_TONE: Record<EngineState, "neutral" | "info" | "caution" | "positive" | "alert"> = {
  IDLE: "neutral", OPPORTUNITY_SELECTED: "info", RUNNING_CREDIT_ENGINE: "info", CREDIT_REJECTED: "caution", QUALIFIED_OPPORTUNITY: "positive",
  RUNNING_CAPITAL_ALLOCATION: "info", DOMESTIC_SELECTED: "positive", GLOBAL_SELECTED: "positive", WAITING_FOR_CAPITAL: "caution",
  FOLLOWING_CAPITAL: "info", LOOP_CLOSED: "positive", ERROR: "alert",
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
  // What the ledger recorded for the request being reasoned about. Fetched on
  // selection rather than on the third act's button, so the act opens on data
  // that is already there instead of a spinner where the money should be.
  const journey = useJourney(selected?.opportunity_id ?? null, Boolean(selected));
  const clock = useEngineRun();
  const canvas = useRef<HTMLDivElement>(null);
  const follow = useRef<HTMLDivElement>(null);
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
    // Three acts, two seams. The credit engine first; capital allocation runs on
    // what it qualified, when asked; then the record of what the capital did.
    //
    // The third act is offered whenever the request qualified, including when
    // engine 2 answers "waiting for capital" — the engines are re-run against
    // today's assumptions and the ledger is not, so the two are allowed to
    // disagree, and that disagreement is worth seeing rather than hiding.
    clock.start(plan.rejected ? plan.total : plan.total + FOLLOW_TICKS,
      plan.rejected ? [] : [plan.creditTicks + 1, plan.total]);
    if (window.innerWidth < 1024) window.setTimeout(() => canvas.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // Which seam the run is waiting at, so each act knows whether it is its turn.
  const heldAfterCredit = Boolean(run) && clock.held && clock.heldAt === run!.plan.creditTicks + 1;
  const heldAfterDecision = Boolean(run) && clock.held && clock.heldAt === run!.plan.total;
  const actsDone = Boolean(run) && clock.tick >= run!.plan.total;
  const followable = Boolean(run) && !run!.plan.rejected;

  const state: EngineState = !selected ? "IDLE" : !run ? "OPPORTUNITY_SELECTED"
    : heldAfterCredit ? "QUALIFIED_OPPORTUNITY"
      : heldAfterDecision || !followable ? stateAt(Math.min(clock.tick, run.plan.total), run.plan, run.result)
        : actsDone ? (clock.done ? "LOOP_CLOSED" : "FOLLOWING_CAPITAL")
          : stateAt(clock.tick, run.plan, run.result);
  const running = state === "RUNNING_CREDIT_ENGINE" || state === "RUNNING_CAPITAL_ALLOCATION" || state === "FOLLOWING_CAPITAL";
  const poolBase = run ? run.plan.creditTicks + 1 : 0;
  const economicsBase = run ? poolBase + run.plan.poolTicks : 0;
  const showAllocation = Boolean(run?.result) && !heldAfterCredit && Boolean(run) && clock.tick >= run!.plan.creditTicks + 1;
  const allocate_ = () => {
    // On a phone the sidebar button sits above the canvas, so each act has to be
    // scrolled to; the third one hangs below the decision rather than at the top.
    const toFollow = heldAfterDecision;
    clock.resume();
    if (window.innerWidth < 1024) {
      window.setTimeout(() => (toFollow ? follow.current : canvas.current)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        meta={<PageEvidence family="readiness_and_eligibility" />}
        eyebrow={tr({ en: "Two engines, one decision, one loop", pt: "Dois motores, uma decisão, um laço" })} title={tr({ en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" })}
        description={tr({
          en: "Pick an opportunity, run the credit engine, run capital allocation on what it qualifies — then follow the capital that decision released, all the way back.",
          pt: "Escolha uma oportunidade, rode o motor de crédito, rode a alocação de capital sobre o que ele qualificar — e depois siga o capital que a decisão liberou, até a volta.",
        })}
        // Two paragraphs, and both are disclosures rather than explanations.
        // What each engine asks is on the engine, in its own header; repeating
        // it here taught the page to a reader who had not run it yet. What is
        // left is the two things a run cannot tell you by watching it: that
        // nothing here writes, and that a pool is a promise rather than a pile
        // of money.
        about={tr({
          en: (
            <>
              <p>Both engines run here in your browser, on today's liquidity and the assumptions in the drawer, with the same code the database runs. Nothing on this page writes: the database allocates when an opportunity opens to investors.</p>
              <p>Liquidity is declared capacity, not money held. EmpowerFI custodies nothing — a pool is what capital has said it will lend through this desk, less what is already lent. An investor's money moves when she funds one named opportunity, into the vault, not into a pool.</p>
            </>
          ),
          pt: (
            <>
              <p>Os dois motores rodam aqui no seu navegador, com a liquidez de hoje e as premissas da gaveta, usando o mesmo código que roda no banco. Nada nesta página escreve: o banco aloca quando uma oportunidade abre para investidores.</p>
              <p>Liquidez é capacidade declarada, não dinheiro guardado. A EmpowerFI não custodia nada — um pool é o quanto o capital disse que empresta por esta mesa, menos o que já está emprestado. O dinheiro da investidora se move quando ela financia uma oportunidade específica, para o cofre, não para um pool.</p>
            </>
          ),
        })}
        /* No door out. Operating economics is still routed and still linked from
           where it is argued about; a panel whose job is to show the mechanism
           does not open with a button to a different screen. */ />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Controls */}
        <div className="panel h-fit space-y-4 p-5 lg:sticky lg:top-20">
          <p className="font-heading text-base font-bold text-foreground">{tr({ en: "Select a qualified opportunity", pt: "Selecione uma oportunidade qualificada" })}</p>
          {!opportunities.data || !policies ? <Skeleton className="h-16 w-full rounded-xl" /> : (
            <OpportunityPicker options={opportunities.data} value={selected} onChange={select} disabled={running} />
          )}
          {selected && <Snapshot o={selected} />}
          {heldAfterCredit ? (
            <Button size="lg" onClick={allocate_}
              className="h-12 w-full gap-2 bg-accent text-base font-bold tracking-wide text-accent-foreground hover:bg-accent/90">
              <Split size={18} /> {tr({ en: "RUN CAPITAL ALLOCATION", pt: "RODAR A ALOCAÇÃO DE CAPITAL" })}
            </Button>
          ) : heldAfterDecision ? (
            <Button size="lg" onClick={allocate_}
              className="h-12 w-full gap-2 bg-accent text-base font-bold tracking-wide text-accent-foreground hover:bg-accent/90">
              <Route size={18} /> {tr({ en: "FOLLOW THE CAPITAL", pt: "SEGUIR O CAPITAL" })}
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

              {heldAfterCredit && (
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
                        chosen={run.result!.pool === pool} done={actsDone} impactEligible={run.o.impact_eligible} />
                    ))}
                  </div>
                  <Flow vertical active={actsDone} />
                </section>
              )}

              {actsDone && (
                <div className="space-y-4">
                  <Decision o={run.o} steps={run.steps} result={run.result} policies={run.policies} fxMilli={fx} settlement={settlement} />
                  {!run.plan.rejected && <Economics o={run.o} />}
                  {/* The pool answered; the rest of the network answered too,
                      and reading only the first makes a pool look like the
                      whole of the capital available to her. */}
                  {!run.plan.rejected && <NetworkPlan o={run.o} chosen={run.result?.pool ?? null} />}
                  {!run.plan.rejected && <VerifyDecision o={run.o} route={run.result?.pool ?? null} />}
                </div>
              )}

              {/* Act 3. The seam before it is the argument of the whole page:
                  everything above is what a conventional fund also decides, and
                  a screen that ends here has described underwriting. */}
              {actsDone && followable && (
                <div ref={follow} className="scroll-mt-20">{heldAfterDecision ? (
                  <div className="flex flex-col items-center gap-2 border-t border-border pt-6 animate-in fade-in duration-300">
                    <ArrowDown size={16} className="text-accent" aria-hidden />
                    <Button size="lg" onClick={allocate_} className="gap-2 bg-accent font-bold tracking-wide text-accent-foreground hover:bg-accent/90">
                      <Route size={18} /> {tr({ en: "FOLLOW THE CAPITAL", pt: "SEGUIR O CAPITAL" })}
                    </Button>
                    <p className="max-w-md text-center text-xs text-muted-foreground">{tr({
                      en: "Both engines have stopped, and a conventional fund's screen stops here too. What follows is not another re-run: it is what this request's own records say the capital then did — crossing into reais, reaching her, moving inside the territory, and coming back.",
                      pt: "Os dois motores pararam, e a tela de um fundo convencional também para aqui. O que vem a seguir não é outra simulação: é o que os registros deste pedido dizem que o capital fez depois — atravessar para reais, chegar a ela, andar dentro do território e voltar.",
                    })}</p>
                  </div>
                ) : (
                  <section className="space-y-4 border-t border-border pt-6 animate-in fade-in duration-300" aria-live="polite">
                    <RecordHeader
                      name={tr({ en: "What the capital did", pt: "O que o capital fez" })}
                      question={tr({
                        en: `Where did ${run.o.code} go after the decision, and what came back?`,
                        pt: `Para onde ${run.o.code} foi depois da decisão, e o que voltou?`,
                      })}
                    />
                    {journey.isError ? (
                      <LoadError error={journey.error} onRetry={() => void journey.refetch()} />
                    ) : !journey.data ? (
                      <Skeleton className="h-96 w-full rounded-xl" />
                    ) : (
                      <FollowCapital journey={journey.data} base={run.plan.total} tick={clock.tick} />
                    )}
                    <p className="text-xs leading-relaxed text-muted-foreground">{tr({
                      en: "Engines 1 and 2 ran here in your browser against today's assumptions; these six stages counted rows that were written when the money moved. They are allowed to disagree — which pool a plan recommends and which pool actually funded a request are two decisions taken at two moments.",
                      pt: "Os motores 1 e 2 rodaram aqui no seu navegador com as premissas de hoje; estas seis etapas contaram linhas escritas quando o dinheiro se moveu. Elas podem divergir — qual pool um plano recomenda e qual pool de fato financiou são duas decisões tomadas em dois momentos.",
                    })}</p>
                  </section>
                )}</div>
              )}
            </>
          )}
        </div>
      </div>

      <p className="px-1 text-xs text-muted-foreground">{prototypeNotice()}</p>
    </div>
  );
}
