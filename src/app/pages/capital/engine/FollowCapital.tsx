import { ArrowUp, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusPill from "../../../components/product/StatusPill";
import { formatNumber, localized, tr } from "../../../i18n";
import { CROSSES_AT, FOLLOWED, FOLLOW_TICKS, STAGE, type Journey, type Stage, type StageKey } from "../../../lib/capitalJourney";
import { EVIDENCE } from "../../../lib/evidence";
import { money } from "../../../lib/readiness";
import { Proof } from "../journey/StageCard";

// Act 3 of the engine page: what actually happened to the request the first two
// acts reasoned about.
//
// Acts 1 and 2 are the engines re-run in this browser against today's
// assumptions — they are a hypothesis, and they can disagree with the record.
// This act is the record: six stages read from the rows each one wrote. The
// header says so, because a page that animates a hypothesis and a ledger in the
// same column and labels neither is inviting the viewer to take the first for
// the second.
//
// Each stage carries its figure and its proof and nothing else. It used to carry
// a link into the screen that wrote it — the Investor Console, the desk, the
// settlement page — which turned a demonstration of the mechanism into a set of
// doors out of it, most of them belonging to somebody else's role. This panel
// shows how the thing works; it is not a table of contents for the product.
//
// It exists because the two engines stop exactly where this product starts to
// differ from a conventional fund. Underwriting and picking a pool are what
// every impact fund also does; the dollar crossing into reais, the money moving
// inside a territory and the instalment releasing the reais that pay the
// investor are what nothing else here could show moving. Those four hops lived
// on another screen as a static tally, which is why nobody could see the loop.

const BAND = localized({
  global: {
    where: { en: "Outside Brazil", pt: "Fora do Brasil" },
    unit: { en: "in dollars", pt: "em dólar" },
  },
  local: {
    where: { en: "Inside the territory", pt: "Dentro do território" },
    unit: { en: "in reais", pt: "em reais" },
  },
});

const usdc = (micro: number) => `${formatNumber(micro / 1e6, { maximumFractionDigits: 2 })} USDC`;

/** The figure a stage leads with, in the currency that stage is denominated in. */
function headline(s: Stage): string {
  if (s.key === "investors_fund" && s.micro_usdc) return usdc(s.micro_usdc);
  return money(s.amount_cents);
}

/** What the stage carries besides its headline, one short line each. */
function detail(s: Stage, fxMilli: number): string[] {
  const meta = STAGE[s.key];
  const lines: string[] = [`${s.count} ${s.count === 1 ? meta.one : meta.unit}`];
  switch (s.key) {
    case "investors_fund":
      lines.push(money(s.amount_cents));
      if ((s.refunded_cents ?? 0) > 0) {
        lines.push(tr({
          en: `${money(s.refunded_cents ?? 0)} went back, unallocated`,
          pt: `${money(s.refunded_cents ?? 0)} voltaram, sem alocação`,
        }));
      }
      break;
    case "position_minted":
      lines.push(s.minted === 0
        ? tr({ en: "none minted to a wallet yet", pt: "nenhuma emitida para uma carteira ainda" })
        : tr({ en: `${s.minted} minted to a wallet`, pt: `${s.minted} emitidas para uma carteira` }));
      break;
    case "dollars_become_reais":
      lines.push(tr({
        en: `at R$ ${formatNumber(fxMilli / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} per USDC`,
        pt: `a R$ ${formatNumber(fxMilli / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} por USDC`,
      }));
      if ((s.saved_cents ?? 0) !== 0) {
        lines.push(tr({
          en: `${money(s.saved_cents ?? 0)} better than the route not taken`,
          pt: `${money(s.saved_cents ?? 0)} melhor que a rota não escolhida`,
        }));
      }
      break;
    case "circulates":
      lines.push(tr({
        en: `${money(s.injected_cents ?? 0)} landed on the rail`,
        pt: `${money(s.injected_cents ?? 0)} aterrissaram no trilho`,
      }));
      // Shown, never added to the headline above it: a merchant's balance is
      // commingled the moment a second customer pays into it, so the next hop
      // belongs to the territory and not to her.
      if ((s.onward_cents ?? 0) > 0) {
        lines.push(tr({
          en: `${money(s.onward_cents ?? 0)} traded onward between merchants — not traced to her`,
          pt: `${money(s.onward_cents ?? 0)} negociados adiante entre comerciantes — sem rastreio até ela`,
        }));
      }
      break;
    case "comes_back":
      if ((s.on_the_rail ?? 0) > 0) {
        lines.push(tr({
          en: `${s.on_the_rail} of them travelled the local rail rather than reais`,
          pt: `${s.on_the_rail} delas viajaram pelo trilho local em vez de reais`,
        }));
      }
      break;
    default:
      break;
  }
  return lines;
}

type RowState = "waiting" | "running" | "settled";

/** One hop, on the rail that runs down the left of the act. */
function Hop({ s, state, fxMilli }: { s: Stage; state: RowState; fxMilli: number }) {
  const meta = STAGE[s.key];
  const settled = state === "settled";
  const arrived = settled && s.happened;
  return (
    <li className="relative flex gap-3">
      {/* The rail itself, and the marker that travels down it. */}
      <span aria-hidden className="relative flex w-5 shrink-0 justify-center">
        <span className={cn("absolute inset-y-0 w-0.5 transition-colors duration-300",
          settled ? "bg-accent/40" : "bg-border")} />
        <span className={cn("relative mt-3 flex h-5 w-5 items-center justify-center rounded-full border bg-card transition-colors duration-300",
          state === "running" ? "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.15)]"
            : arrived ? "border-accent/60" : "border-border")}>
          {state === "running"
            ? <Loader2 size={12} className="animate-spin text-accent motion-reduce:animate-none" />
            : <Circle size={8} className={arrived ? "fill-accent text-accent" : "text-muted-foreground/50"} />}
        </span>
      </span>

      <div className={cn("min-w-0 flex-1 rounded-xl border px-4 py-3 transition-all duration-300",
        state === "waiting" ? "border-border/60 bg-background/20 opacity-50"
          : state === "running" ? "border-accent/60 bg-accent/5"
            : arrived ? "border-border bg-card" : "border-border/60 bg-background/30 opacity-70")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 font-heading text-sm font-bold text-foreground">
            <span className="num mr-1.5 text-muted-foreground">{s.no}</span>{meta.title}
          </p>
          {settled && (
            <p className={cn("num font-heading text-lg font-bold animate-in fade-in duration-300",
              arrived ? "text-foreground" : "text-muted-foreground")}>
              {arrived ? headline(s) : tr({ en: "not yet", pt: "ainda não" })}
            </p>
          )}
        </div>

        {settled && arrived && (
          <ul className="num mt-1 space-y-0.5 text-xs text-muted-foreground animate-in fade-in duration-300">
            {detail(s, fxMilli).map((l) => <li key={l}>{l}</li>)}
          </ul>
        )}
        {settled && !arrived && (
          <p className="mt-1 text-xs text-muted-foreground">
            {tr({
              en: "This request has not reached this stage. Nothing is drawn past a stage that has not happened.",
              pt: "Este pedido não chegou a esta etapa. Nada é desenhado depois de uma etapa que não aconteceu.",
            })}
          </p>
        )}
        {state === "running" && <p className="mt-1 text-xs text-accent">{tr({ en: "reading the records…", pt: "lendo os registros…" })}</p>}

        {settled && arrived && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill tone={EVIDENCE[s.evidence].tone} dot={false}>{EVIDENCE[s.evidence].label}</StatusPill>
            <Proof s={s} />
          </div>
        )}
      </div>
    </li>
  );
}

/** Which side of the border the money is on, and in what currency. */
function Band({ side }: { side: "global" | "local" }) {
  const b = BAND[side];
  return (
    <li className="flex items-center gap-3 pt-1">
      <span aria-hidden className="flex w-5 shrink-0 justify-center"><span className="h-full w-0.5 bg-border" /></span>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {b.where} <span className="font-normal normal-case tracking-normal">· {b.unit}</span>
      </p>
    </li>
  );
}

/**
 * The crossing. It gets its own band rather than being one row among six
 * because it is the only line on this page where the money changes country and
 * currency, and every claim the company makes about connecting global capital
 * to a local economy is spent here.
 */
function Crossing({ shown, fxMilli }: { shown: boolean; fxMilli: number }) {
  return (
    <li className={cn("flex items-center gap-3 py-1 transition-opacity duration-300", shown ? "opacity-100" : "opacity-40")}>
      <span aria-hidden className="flex w-5 shrink-0 justify-center"><span className="h-6 w-0.5 bg-accent/40" /></span>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className={cn("h-px flex-1 transition-colors duration-300", shown ? "bg-accent/50" : "bg-border")} />
        <span className="num shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {tr({ en: "the crossing", pt: "a travessia" })} · R$ {formatNumber(fxMilli / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}/USDC
        </span>
        <span aria-hidden className={cn("h-px flex-1 transition-colors duration-300", shown ? "bg-accent/50" : "bg-border")} />
      </span>
    </li>
  );
}

/**
 * The return: what came back, on its way out to the investor.
 *
 * The headline is what the business repaid, not what the local rail released.
 * An instalment can come back as reais without ever touching the rail, and
 * leading with the rail's figure would print R$ 0,00 over a request that repaid
 * in full — a closed loop reported as a failed one.
 */
function Return({ s, shown }: { s: Stage; shown: boolean }) {
  const fromRail = s.from_the_rail_cents ?? 0;
  const onRail = s.on_the_rail ?? 0;
  return (
    <li className={cn("flex gap-3 transition-opacity duration-300", shown ? "opacity-100" : "opacity-0")} aria-hidden={!shown}>
      <span aria-hidden className="flex w-5 shrink-0 justify-center">
        <ArrowUp size={16} className="mt-1 text-accent" />
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {tr({ en: "Back out to the investor", pt: "De volta para o investidor" })}
        </p>
        <p className="num mt-1 font-heading text-lg font-bold text-foreground">{money(s.amount_cents)}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {onRail > 0
            ? tr({
              en: `${money(fromRail)} of it came back through the local rail: units returning to the treasury release exactly the reais that were held behind them, and those reais are what the investor is paid out of.`,
              pt: `${money(fromRail)} disso voltaram pelo trilho local: as unidades que voltam para a tesouraria liberam exatamente os reais que estavam guardados atrás delas, e são esses reais que pagam o investidor.`,
            })
            : tr({
              en: "None of it travelled the local rail on this request — the instalments came back as reais directly. The rail is one of two ways home, not the only one.",
              pt: "Nada disso viajou pelo trilho local neste pedido — as parcelas voltaram direto em reais. O trilho é um dos dois caminhos de volta, não o único.",
            })}
        </p>
      </div>
    </li>
  );
}

export default function FollowCapital({ journey, base, tick }: { journey: Journey; base: number; tick: number }) {
  const stageOf = (k: StageKey) => journey.stages.find((s) => s.key === k);
  const stateOf = (i: number): RowState => (tick < base + i ? "waiting" : tick === base + i ? "running" : "settled");
  const fx = journey.fx_brl_per_usdc_milli;
  const last = stageOf("comes_back");

  return (
    <ol className="space-y-1">
      <Band side="global" />
      {FOLLOWED.map((k, i) => {
        const s = stageOf(k);
        if (!s) return null;
        return (
          <div key={k} className="contents">
            {i === CROSSES_AT && <Crossing shown={tick >= base + i} fxMilli={fx} />}
            {i === CROSSES_AT && <Band side="local" />}
            <Hop s={s} state={stateOf(i)} fxMilli={fx} />
          </div>
        );
      })}
      {last && <Return s={last} shown={tick >= base + FOLLOW_TICKS && last.happened} />}
    </ol>
  );
}
