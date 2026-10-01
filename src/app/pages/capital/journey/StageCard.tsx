import { Link } from "react-router-dom";
import {
  ArrowRight, Banknote, Coins, Gem, Globe2, HandCoins, Landmark, Loader2, Split, Sprout, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import StatusPill from "../../../components/product/StatusPill";
import type { RailState } from "../../../lib/moneyRail";
import { tr } from "../../../i18n";
import { STAGE, type Stage, type StageKey } from "../../../lib/capitalJourney";
import { EVIDENCE } from "../../../lib/evidence";
import { money } from "../../../lib/readiness";

// One stage of the journey. Three things travel together on every card and none
// of them stands for the others: how much, where it can be checked, and what
// kind of claim it is. A stage can be true and unanchored — the local rail
// writes no anchor at all — so proof is reported beside the money rather than
// implied by it.

const ICON: Record<StageKey, LucideIcon> = {
  capital_exists: Landmark,
  she_asks: HandCoins,
  engine_routes: Split,
  investors_fund: Coins,
  position_minted: Gem,
  dollars_become_reais: Globe2,
  disbursed: Banknote,
  circulates: Sprout,
  comes_back: ArrowRight,
};

export function Proof({ s }: { s: Stage }) {
  const { total, confirmed, failed } = s.anchors;
  if (total === 0) {
    return (
      <StatusPill tone="neutral" dot={false}>
        {tr({ en: "Not anchored", pt: "Sem registro em cadeia" })}
      </StatusPill>
    );
  }
  if (failed > 0) {
    return <StatusPill tone="alert">{tr({ en: `${failed} failed to anchor`, pt: `${failed} falharam ao registrar` })}</StatusPill>;
  }
  // "0 of 25 on Solana" reads as "none of this can be proven", which is not what
  // a queue means. Nothing confirmed yet and nothing failed is a worker that has
  // not got to them, and the pill says that instead.
  if (confirmed === 0) {
    return (
      <StatusPill tone="info">
        {tr({ en: `${total} queued for Solana`, pt: `${total} na fila para a Solana` })}
      </StatusPill>
    );
  }
  return (
    <StatusPill tone={confirmed === total ? "positive" : "info"} dot={confirmed !== total}>
      {tr({
        en: confirmed === total ? `All ${total} on Solana` : `${confirmed} of ${total} on Solana`,
        pt: confirmed === total ? `Todos os ${total} na Solana` : `${confirmed} de ${total} na Solana`,
      })}
    </StatusPill>
  );
}

/** A second figure the stage carries, where it has one worth its own line. */
function Detail({ s }: { s: Stage }) {
  const lines: string[] = [];
  if (s.key === "engine_routes") {
    lines.push(tr({
      en: `${money(s.domestic_cents ?? 0)} from inside Brazil, ${money(s.global_cents ?? 0)} from abroad`,
      pt: `${money(s.domestic_cents ?? 0)} de dentro do Brasil, ${money(s.global_cents ?? 0)} de fora`,
    }));
  }
  if (s.key === "investors_fund" && (s.refunded_cents ?? 0) > 0) {
    lines.push(tr({
      en: `${money(s.refunded_cents ?? 0)} went back to investors, unallocated`,
      pt: `${money(s.refunded_cents ?? 0)} voltaram aos investidores, sem alocação`,
    }));
  }
  if (s.key === "position_minted") {
    lines.push(s.minted === 0
      ? tr({
        en: "None minted yet: a position is minted when a wallet claims it.",
        pt: "Nenhuma emitida ainda: uma posição é emitida quando uma carteira a reivindica.",
      })
      : tr({ en: `${s.minted} minted to a wallet`, pt: `${s.minted} emitidas para uma carteira` }));
  }
  if (s.key === "dollars_become_reais" && (s.saved_cents ?? 0) !== 0) {
    lines.push(tr({
      en: `${money(s.saved_cents ?? 0)} better than the route not taken`,
      pt: `${money(s.saved_cents ?? 0)} melhor que a rota não escolhida`,
    }));
  }
  if (s.key === "circulates") {
    lines.push(tr({
      en: `${money(s.injected_cents ?? 0)} landed on the rail`,
      pt: `${money(s.injected_cents ?? 0)} aterrissaram no trilho`,
    }));
    // Never added to the figure above it. A merchant's balance is commingled
    // the moment a second customer pays it, so the next hop is the territory's
    // and not hers.
    if ((s.onward_cents ?? 0) > 0) {
      lines.push(tr({
        en: `${money(s.onward_cents ?? 0)} traded onward between merchants — same territory, not traced to her`,
        pt: `${money(s.onward_cents ?? 0)} negociados adiante entre comerciantes — mesmo território, sem rastreio até ela`,
      }));
    }
  }
  if (s.key === "comes_back" && (s.on_the_rail ?? 0) > 0) {
    lines.push(tr({
      en: `${s.on_the_rail} of them travelled the local rail rather than reais`,
      pt: `${s.on_the_rail} delas viajaram pelo trilho local em vez de reais`,
    }));
    // The figure that makes this a loop rather than a one-way grant with extra
    // steps: units returning to the treasury release exactly the reais behind
    // them, and those reais are the investor's return.
    lines.push(tr({
      en: `${money(s.from_the_rail_cents ?? 0)} of local units redeemed back to reais, on its way to the investor`,
      pt: `${money(s.from_the_rail_cents ?? 0)} de unidades locais resgatadas de volta para reais, a caminho do investidor`,
    }));
  }
  if (lines.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {lines.map((l) => <li key={l} className="num">{l}</li>)}
    </ul>
  );
}

export default function StageCard({ s, state = "settled" }: { s: Stage; state?: RailState }) {
  const meta = STAGE[s.key];
  const Icon = ICON[s.key];
  const label = EVIDENCE[s.evidence];
  // Two reasons a card can be dim and they must not fight: the run has not
  // reached it yet, or the stage never happened. The first is temporary and the
  // second is the reading, so arrival settles into whichever the stage is.
  const waiting = state === "waiting";

  return (
    <li className={cn(
      "panel flex min-w-0 flex-col gap-3 p-4 transition-all duration-300 ease-out",
      "motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100",
      waiting ? "translate-y-1 opacity-40" : s.happened ? "translate-y-0 opacity-100" : "translate-y-0 opacity-70",
      state === "running" && "border-accent/50",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 motion-reduce:transition-none",
              state === "running" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground")}
            aria-hidden
          >
            {state === "running" ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : s.no}
          </span>
          <h3 className="min-w-0 font-heading text-sm font-bold text-foreground">{meta.title}</h3>
        </div>
        <Icon size={14} className="mt-1 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      {s.happened ? (
        <>
          <div className="space-y-0.5">
            <p className="num font-heading text-2xl font-bold text-foreground">{money(s.amount_cents)}</p>
            <p className="num text-xs text-muted-foreground">{s.count} {s.count === 1 ? meta.one : meta.unit}</p>
          </div>
          <Detail s={s} />
        </>
      ) : (
        // A stage that has not happened says so. An arrow drawn to the next one
        // regardless would make this page a diagram, and a diagram is free.
        <p className="text-sm text-muted-foreground">
          {tr({ en: "Has not happened yet on this reading.", pt: "Ainda não aconteceu nesta leitura." })}
        </p>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{meta.what}</p>

      <div className="mt-auto space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone={label.tone} dot={false}>{label.label}</StatusPill>
          <Proof s={s} />
        </div>
        <Link
          to={meta.to}
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {tr({ en: `Check it on ${meta.toLabel}`, pt: `Conferir em ${meta.toLabel}` })}
          <ArrowRight size={12} aria-hidden />
        </Link>
      </div>
    </li>
  );
}
