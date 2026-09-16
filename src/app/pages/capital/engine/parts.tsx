import type { ReactNode } from "react";
import { Check, Circle, Loader2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeState } from "./labels";
import { localized, tr } from "../../../i18n";

const ICON: Record<NodeState, ReactNode> = {
  waiting: <Circle size={14} className="text-muted-foreground/60" aria-hidden />,
  evaluating: <Loader2 size={14} className="animate-spin text-accent motion-reduce:animate-none" aria-hidden />,
  passed: <Check size={14} strokeWidth={3} className="text-positive" aria-hidden />,
  failed: <X size={14} strokeWidth={3} className="text-caution" aria-hidden />,
  skipped: <Minus size={14} className="text-muted-foreground/50" aria-hidden />,
};

const RING: Record<NodeState, string> = {
  waiting: "border-border bg-background/40",
  evaluating: "border-accent/60 bg-accent/10 shadow-[0_0_0_3px_hsl(var(--accent)/0.12)]",
  passed: "border-positive/40 bg-positive/10",
  failed: "border-caution/50 bg-caution/10",
  skipped: "border-border/60 bg-background/20",
};

const STATE_WORD = localized({
  waiting: { en: "waiting", pt: "aguardando" },
  evaluating: { en: "evaluating", pt: "avaliando" },
  passed: { en: "passed", pt: "aprovado" },
  failed: { en: "failed", pt: "reprovado" },
  skipped: { en: "not asked", pt: "não avaliado" },
});

/** One check: its state as an icon, its title, and what was compared once it settles. */
export function StepNode({ state, title, detail, compact = false }: { state: NodeState; title: string; detail?: ReactNode; compact?: boolean }) {
  const settled = state === "passed" || state === "failed";
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3 transition-colors duration-300", compact ? "py-2" : "py-2.5", RING[state],
      state === "waiting" || state === "skipped" ? "opacity-60" : "opacity-100")}
      aria-label={`${title}: ${STATE_WORD[state]}`}>
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-card", state === "evaluating" ? "border-accent/60" : "border-border")}>
        {ICON[state]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight text-foreground">{title}</span>
        {settled && detail && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground animate-in fade-in duration-300">{detail}</span>}
        {state === "evaluating" && <span className="mt-0.5 block text-xs text-accent">{STATE_WORD.evaluating}…</span>}
      </span>
    </div>
  );
}

/** A connector that fills once the step before it has settled. */
export function Flow({ active, vertical = false, className }: { active: boolean; vertical?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block overflow-hidden rounded-full bg-border", vertical ? "mx-auto h-5 w-0.5" : "h-0.5 w-full", className)}>
      <span className={cn("absolute inset-0 origin-left bg-accent transition-transform duration-300 ease-out motion-reduce:transition-none",
        vertical ? "origin-top" : "origin-left",
        active ? "scale-100" : vertical ? "scale-y-0" : "scale-x-0")} />
    </span>
  );
}

/** A labelled section of the canvas: which engine, and the question it answers. */
export function EngineHeader({ n, name, question, right }: { n: 1 | 2; name: string; question: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{tr({ en: `Engine ${n}`, pt: `Motor ${n}` })}</p>
        <h3 className="font-heading text-lg font-bold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground">{question}</p>
      </div>
      {right}
    </div>
  );
}
