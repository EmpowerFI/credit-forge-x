import type { ReactNode } from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { tr } from "../../i18n";
import { usdcFromReais } from "../../lib/investor";
import { money } from "../../lib/readiness";
import { REALITY, reaisRate, type Reality } from "../../lib/settlement";
import { usdc } from "../../lib/solana";

// Her loan is written in reais and funded in dollars. This is that sentence as
// a screen: the two figures that bind her, each with the dollars they are worth
// today, and the five steps the money takes between the two currencies.

export type LifecycleStage = "funded" | "locked" | "disbursed" | "repayments" | "settlement";

export interface StageState {
  /** True once this step has actually happened for this position. */
  done: boolean;
  reality: Reality;
  detail: ReactNode;
}

/** The lifecycle the addendum names, in its order. Each page fills in what it knows. */
const STAGE_LABEL: Record<LifecycleStage, string> = {
  funded: tr({ en: "USDC funded", pt: "Captado em USDC" }),
  locked: tr({ en: "BRL locked", pt: "Reais travados" }),
  disbursed: tr({ en: "Pix disbursed", pt: "Pix desembolsado" }),
  repayments: tr({ en: "BRL repayments", pt: "Parcelas em reais" }),
  settlement: tr({ en: "Investor settlement", pt: "Repasse ao investidor" }),
};

const ORDER: LifecycleStage[] = ["funded", "locked", "disbursed", "repayments", "settlement"];

function Figure({ label, cents, fxMilli, sub }: { label: string; cents: number; fxMilli: number | null; sub?: ReactNode }) {
  const micro = fxMilli ? usdcFromReais(cents, fxMilli) : null;
  return (
    <div className="min-w-0 space-y-0.5 rounded-xl border border-border bg-background/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num font-heading text-xl font-bold text-foreground">{money(cents)}</p>
      <p className="num text-xs text-muted-foreground">
        {micro === null ? "—" : tr({
          en: `≈ ${usdc(micro, 0)} at ${reaisRate(fxMilli!, 3)}/USDC · informational`,
          pt: `≈ ${usdc(micro, 0)} a ${reaisRate(fxMilli!, 3)}/USDC · informativo`,
        })}
      </p>
      {sub && <p className="num text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Stage({ stage, state }: { stage: LifecycleStage; state: StageState }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden className={cn("h-1 rounded-full", state.done ? "bg-positive" : "bg-border")} />
      <span className="flex items-start gap-1.5">
        {state.done
          ? <Check size={14} className="mt-0.5 shrink-0 text-positive" aria-hidden />
          : <Circle size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="text-sm font-medium text-foreground">{STAGE_LABEL[stage]}</span>
        <span className="sr-only">
          {state.done ? tr({ en: "done", pt: "concluído" }) : tr({ en: "not yet", pt: "ainda não" })}
        </span>
      </span>
      <span className="num text-xs text-muted-foreground">{state.detail}</span>
      <span className="mt-auto pt-0.5"><StatusPill tone={REALITY[state.reality].tone} dot={false}>{REALITY[state.reality].label}</StatusPill></span>
    </li>
  );
}

/**
 * The obligation in reais with an informational dollar equivalent (addendum
 * §8.2), and the lifecycle line beneath it. Global pool only: it is the pool
 * where the two currencies meet.
 */
export default function Lifecycle({ principalCents, instalmentCents, termMonths, fxMilli, stages, children, folded, numeral }: {
  principalCents: number;
  instalmentCents: number;
  termMonths: number;
  fxMilli: number | null;
  stages: Record<LifecycleStage, StageState>;
  children?: ReactNode;
  /** What happens after she commits: worth having, not worth reading first. */
  folded?: boolean;
  numeral?: string;
}) {
  return (
    <Panel folded={folded} numeral={numeral} title={tr({ en: "Written in reais, funded in dollars", pt: "Escrito em reais, financiado em dólares" })}
      description={tr({
        en: "She owes reais: the principal and every instalment are fixed in her currency, and never move with the exchange rate. The dollar figures are what those reais are worth at the quote this opportunity holds — informational, and never what she repays.",
        pt: "A dívida da empreendedora é em reais: o principal e cada parcela são fixos na moeda dela e não se movem com o câmbio. Os valores em dólar são quanto esses reais valem pela cotação que esta oportunidade carrega — informativos, e nunca o que ela paga.",
      })}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Figure label={tr({ en: "Principal, contracted in reais", pt: "Principal, contratado em reais" })} cents={principalCents} fxMilli={fxMilli} />
        <Figure label={tr({ en: "What she repays in total", pt: "O que a empreendedora paga no total" })} cents={instalmentCents * termMonths} fxMilli={fxMilli}
          sub={tr({ en: `${termMonths} × ${money(instalmentCents)}`, pt: `${termMonths} × ${money(instalmentCents)}` })} />
      </div>

      <ol className="grid gap-x-4 gap-y-5 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
        {ORDER.map((s) => <Stage key={s} stage={s} state={stages[s]} />)}
      </ol>

      {children}
    </Panel>
  );
}
