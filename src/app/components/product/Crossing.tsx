import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, tr } from "../../i18n";
import { anyWayOut, crossingKey, intoZec, NoRoute, WAYS_IN, type Crossing as Priced, type WayIn } from "../../lib/oneClick";
import { usdc } from "../../lib/solana";
import { zec } from "../../lib/zcash";

// What it costs to cross, said by the people who would do the crossing.
//
// A price panel is not the point. The point is that the ZEC leg of this product
// stops being a currency the platform happens to take and becomes one side of a
// route that a market prices, commits a floor to, and puts a clock on. The
// three numbers are the argument: what arrives, the least that arrives, and how
// long it takes.
//
// The quote is live and the movement beside it is ours, on testnet. Saying so
// on the panel is not a disclaimer — it is the only way the live number means
// anything.

const minutes = (seconds: number) =>
  seconds < 90
    ? tr({ en: `about ${Math.round(seconds)}s`, pt: `cerca de ${Math.round(seconds)}s` })
    : tr({ en: `about ${Math.round(seconds / 60)} min`, pt: `cerca de ${Math.round(seconds / 60)} min` });

const percent = (fraction: number) =>
  `${formatNumber(fraction * 100, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;

function Figures({ priced, from, to }: { priced: Priced; from: string; to: (base: number) => string }) {
  return (
    <>
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="num font-heading text-lg font-bold text-foreground">{from}</span>
        <ArrowRight size={14} className="shrink-0 text-accent" aria-hidden />
        <span className="num font-heading text-lg font-bold text-foreground">{to(priced.outBase)}</span>
      </p>
      <p className="num text-xs text-muted-foreground">
        {tr({
          en: `at least ${to(priced.minBase)} · the crossing costs ${percent(priced.cost)} · ${minutes(priced.seconds)}`,
          pt: `no mínimo ${to(priced.minBase)} · a travessia custa ${percent(priced.cost)} · ${minutes(priced.seconds)}`,
        })}
      </p>
      {/* Most of what a small crossing costs is a flat withdrawal fee on the
          Zcash side, so the percentage is a statement about the size as much as
          about the route. A reader looking at 9% on five dollars deserves to
          know that, rather than concluding the rail is expensive. */}
      {priced.cost > 0.03 && (
        <p className="text-[11px] leading-snug text-caution">
          {tr({
            en: "Most of that is a flat fee on the Zcash side, so the share falls as the amount rises.",
            pt: "A maior parte disso é uma taxa fixa do lado da Zcash, então essa fatia cai conforme o valor sobe.",
          })}
        </p>
      )}
    </>
  );
}

function Frame({ leg, title, children, right, quoted }: {
  leg: "in" | "out"; title: string; children: React.ReactNode; right?: React.ReactNode;
  /** Whether a price actually came back. Nothing was quoted live if nothing was quoted. */
  quoted: boolean;
}) {
  return (
    <div data-crossing={leg} className="min-w-0 space-y-1.5 rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[11px] font-medium uppercase tracking-wider text-accent">{title}</p>
        {right}
      </div>
      {children}
      {quoted && <p className="text-[11px] leading-snug text-muted-foreground">
        {tr({
          en: "Quoted live by NEAR Intents' solver network, which has no testnet — so this price is mainnet and the movement on this page is testnet. Nothing is swapped here.",
          pt: "Cotado ao vivo pela rede de solvers da NEAR Intents, que não tem testnet — então este preço é de mainnet e o movimento desta página é de testnet. Nada é trocado aqui.",
        })}
      </p>}
    </div>
  );
}

function Body({ query, children }: { query: { isPending: boolean; error: unknown }; children: React.ReactNode }) {
  if (query.isPending) return <Skeleton className="h-10 w-full" />;
  if (query.error) {
    return (
      <p className="text-xs text-muted-foreground">
        {query.error instanceof NoRoute
          ? tr({ en: "No chain is pricing this crossing right now.", pt: "Nenhuma rede está cotando esta travessia agora." })
          : tr({ en: "The price could not be read just now.", pt: "Não foi possível ler o preço agora." })}
      </p>
    );
  }
  return <>{children}</>;
}

/**
 * What the ZEC of a return is worth crossing back to USDC, and on which chain.
 *
 * Solana is asked first and the title names whatever answered. Which
 * destinations are quotable moves within a day — ZEC → Solana quoted all one
 * morning and was gone by evening while Base still priced — so a panel fixed to
 * one chain would report the whole feature dead over a single solver stepping
 * away from a single pair.
 */
export function CrossingOut({ zat }: { zat: number }) {
  const q = useQuery({
    queryKey: crossingKey("out", zat),
    queryFn: () => anyWayOut(zat),
    enabled: zat > 0,
    staleTime: 60_000,
    refetchInterval: 90_000,
    retry: false,
  });
  return (
    <Frame leg="out" quoted={Boolean(q.data)}
      title={q.data
        ? tr({ en: `Out to USDC on ${q.data.name}, priced now`, pt: `Saída para USDC na ${q.data.name}, cotada agora` })
        : tr({ en: "Out to USDC, priced now", pt: "Saída para USDC, cotada agora" })}>
      <Body query={q}>
        {q.data && <Figures priced={q.data.crossing} from={zec(zat, "main")} to={(base) => usdc(base)} />}
      </Body>
    </Frame>
  );
}

/**
 * What it takes, in USDC on a chain this market does route from, to arrive with
 * the ZEC this opportunity asks for. Solana is not one of them, and the caller
 * says so where it matters.
 */
export function CrossingIn({ microUsdc }: { microUsdc: number }) {
  const [chain, setChain] = useState<WayIn>(WAYS_IN[0].chain);
  const q = useQuery({
    queryKey: crossingKey(`in:${chain}`, microUsdc),
    queryFn: () => intoZec(chain, microUsdc),
    enabled: microUsdc > 0,
    staleTime: 60_000,
    refetchInterval: 90_000,
    retry: false,
  });
  return (
    <Frame
      leg="in"
      quoted={Boolean(q.data)}
      title={tr({ en: "In from USDC, priced now", pt: "Entrada a partir de USDC, cotada agora" })}
      right={
        <span className="flex items-center gap-1">
          {q.isFetching && <Loader2 size={11} className="animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />}
          <label className="sr-only" htmlFor="crossing-chain">{tr({ en: "Chain you hold USDC on", pt: "Rede em que você tem USDC" })}</label>
          <select id="crossing-chain" value={chain} onChange={(e) => setChain(e.target.value as WayIn)}
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-foreground">
            {WAYS_IN.map((w) => <option key={w.chain} value={w.chain}>{w.name}</option>)}
          </select>
        </span>
      }>
      <Body query={q}>
        {q.data && <Figures priced={q.data} from={usdc(microUsdc)} to={(base) => zec(base, "main")} />}
      </Body>
    </Frame>
  );
}
