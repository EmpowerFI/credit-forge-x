import { BadgeCheck, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "../../../i18n";
import type { CreditStep, EngineOpportunity } from "../../../lib/engine";
import { creditDetail, CREDIT_STEP_TITLE, nodeState } from "./labels";
import { EngineHeader, Flow, StepNode } from "./parts";

/**
 * Engine 1, the credit engine, as a pipeline: each step waits, evaluates and
 * settles in turn, and the pipeline stops at the first step that did not pass.
 * The results are the recorded readiness and eligibility, proven on Solana.
 */
export default function CreditEngine({ o, steps, tick }: { o: EngineOpportunity; steps: CreditStep[]; tick: number }) {
  const stopAt = steps.findIndex((s) => !s.passed);
  const settledAll = stopAt === -1 ? tick >= steps.length : tick > stopAt;
  const qualified = stopAt === -1;
  return (
    <section className="space-y-4" aria-live="polite">
      <EngineHeader n={1} name={tr({ en: "Credit engine", pt: "Motor de crédito" })}
        question={tr({ en: "Should this business become a qualified credit opportunity?", pt: "Este negócio deve virar uma oportunidade de crédito qualificada?" })}
        right={<span className="text-xs text-muted-foreground">{o.readiness.model_version} · {o.eligibility.model_version}</span>} />

      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.id}>
            <StepNode state={nodeState(i, tick, s.passed, stopAt !== -1 && i > stopAt && tick > stopAt)}
              title={CREDIT_STEP_TITLE[s.id]} detail={creditDetail(s.id, o)} />
          </li>
        ))}
      </ol>

      <Flow vertical active={settledAll} />

      <div className={cn(
        "mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300",
        !settledAll ? "border-border text-muted-foreground opacity-50"
          : qualified ? "tone-positive" : "tone-caution",
      )}>
        {settledAll && !qualified ? <CircleSlash size={16} aria-hidden /> : <BadgeCheck size={16} aria-hidden />}
        {!settledAll
          ? tr({ en: "Output: qualified credit opportunity?", pt: "Resultado: oportunidade de crédito qualificada?" })
          : qualified
            ? tr({ en: "Qualified credit opportunity", pt: "Oportunidade de crédito qualificada" })
            : tr({ en: "Not qualified yet: no pool is asked", pt: "Ainda não qualificada: nenhum pool é consultado" })}
      </div>
    </section>
  );
}
