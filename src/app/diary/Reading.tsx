import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Sparkles } from "lucide-react";
import { tr } from "../i18n";
import { addDays, brl, diary, mondayOf, type WeekReading, weekSpan } from "./diary";
import { ProfitValue } from "./Month";

const READINGS_KEY = ["diary", "readings"] as const;

/** Her readings, newest first. */
function useReadings() {
  return useQuery({ queryKey: READINGS_KEY, queryFn: () => diary.readings(12) });
}

/**
 * Asks once per day she opens the diary whether the week that has just
 * closed is due a reading; when one is written, the list is fetched again.
 * A failure is quiet: the reading is asked for again on the next opening.
 */
function useCheckReading(today: string) {
  const queryClient = useQueryClient();
  const check = useQuery({
    queryKey: ["diary", "reading-check", today],
    queryFn: diary.checkReading,
    staleTime: Infinity,
    retry: false,
  });
  const written = check.data?.status === "written";
  useEffect(() => {
    if (written) void queryClient.invalidateQueries({ queryKey: READINGS_KEY });
  }, [written, queryClient]);
}

/** "1.240,00", and "1.240" when the centavos are zero: the two ways the reading may write an amount. */
const amountForms = (cents: number) => {
  const full = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  return full.endsWith(",00") ? [full, full.slice(0, -3)] : [full];
};

/**
 * Which colour each amount in the reading takes, from the figures it was
 * written from: profit green and a loss red, sales blue, expenses orange.
 * An amount that is none of them (her salary, last week's sales) stays ink.
 */
function amountColours(f: WeekReading["figures"]): Map<string, string> {
  const colours = new Map<string, string>();
  if (!f) return colours;
  const put = (cents: number | null, colour: string) => {
    if (cents === null || cents === 0) return;
    for (const form of amountForms(cents)) if (!colours.has(form)) colours.set(form, colour);
  };
  const bottom = f.profit_cents ?? f.result_cents;
  put(bottom, bottom !== null && bottom < 0 ? "text-alert" : "text-positive");
  put(f.sales_cents, "text-sales");
  put(f.expenses_cents, "text-expense");
  return colours;
}

/** The reading's sentence, with each amount it knows in its colour and in bold. */
function painted(text: string, colours: Map<string, string>): ReactNode {
  if (!colours.size) return text;
  const parts = text.split(/(R\$\s?-?\d[\d.]*(?:,\d{2})?)/);
  return parts.map((part, n) => {
    const amount = part.match(/^R\$\s?-?(\d[\d.]*(?:,\d{2})?)$/)?.[1];
    const colour = amount ? colours.get(amount) : undefined;
    return colour ? <strong key={n} className={`whitespace-nowrap ${colour}`}>{part}</strong> : <Fragment key={n}>{part}</Fragment>;
  });
}

/** The week's money at a glance: sales, expenses, and what was left. */
function Figures({ f }: { f: NonNullable<WeekReading["figures"]> }) {
  const bottom = f.profit_cents ?? f.result_cents;
  const bottomLabel = f.profit_cents !== null
    ? (f.profit_cents < 0 ? tr({ en: "Loss", pt: "Prejuízo" }) : tr({ en: "Profit", pt: "Lucro" }))
    : tr({ en: "Result", pt: "Resultado" });
  const cell = "min-w-0 rounded-lg bg-secondary/60 px-2 py-1.5";
  return (
    <div className="grid grid-cols-3 gap-1.5 text-xs">
      <div className={cell}>
        <p className="font-medium text-sales">{tr({ en: "Sales", pt: "Vendas" })}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-sales">{brl(f.sales_cents)}</p>
      </div>
      <div className={cell}>
        <p className="font-medium text-expense">{tr({ en: "Expenses", pt: "Gastos" })}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-expense">{f.expenses_cents === null ? "—" : brl(f.expenses_cents)}</p>
      </div>
      <div className={cell}>
        <p className="font-medium text-muted-foreground">{bottomLabel}</p>
        {bottom === null
          ? <p className="text-sm font-semibold">—</p>
          : <ProfitValue cents={bottom} className="whitespace-nowrap text-sm font-semibold [&>svg]:hidden" />}
      </div>
    </div>
  );
}

/** One reading, as she reads it. */
export function ReadingCard({ reading, open = true, collapsible = false }: { reading: WeekReading; open?: boolean; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const r = reading.report;
  const colours = amountColours(reading.figures);
  const body = (
    <div className="space-y-2 text-sm leading-relaxed">
      {reading.figures && <Figures f={reading.figures} />}
      <p>{painted(r.summary, colours)}</p>
      {r.observations.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {r.observations.map((o) => <li key={o}>{painted(o, colours)}</li>)}
        </ul>
      )}
      <p><strong>{tr({ en: "For this week:", pt: "Para esta semana:" })}</strong> {painted(r.action, colours)}</p>
      <p className="text-sm text-muted-foreground">
        {reading.days_kept > (reading.open_days ?? 7)
          // She recorded on a day she usually closes: it counts, and the sentence says so.
          ? tr({ en: `You recorded ${reading.days_kept} days that week.`, pt: `Você registrou ${reading.days_kept} dias nessa semana.` })
          : tr({
            en: `You recorded ${reading.days_kept} of the ${reading.open_days ?? 7} days your business opens that week.`,
            pt: `Você registrou ${reading.days_kept} dos ${reading.open_days ?? 7} dias em que seu negócio abre nessa semana.`,
          })}
      </p>
      {reading.source === "model" && (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">{tr({ en: "Written by AI.", pt: "Escrita por IA." })}</p>
      )}
    </div>
  );
  const title = tr({ en: `Week of ${weekSpan(reading.week_start)}`, pt: `Semana de ${weekSpan(reading.week_start)}` });

  if (collapsible) {
    // On Hoje: closed until she opens it, so the screen is not all reading.
    return (
      <section className="rounded-xl border-2 border-primary/30 bg-card" aria-labelledby={`reading-${reading.week_start}`}>
        <button type="button" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Sparkles size={16} aria-hidden="true" />{tr({ en: "Your week, read", pt: "Sua leitura da semana" })}
            </span>
            <span id={`reading-${reading.week_start}`} className="block font-heading text-lg font-semibold">{title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
            {expanded ? tr({ en: "Close", pt: "Fechar" }) : tr({ en: "Read", pt: "Ler" })}
            <ChevronDown size={18} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
          </span>
        </button>
        <div id={bodyId} hidden={!expanded} className="px-4 pb-4">{body}</div>
      </section>
    );
  }

  if (open) {
    return (
      <section className="space-y-2 rounded-xl border-2 border-primary/30 bg-card p-4" aria-labelledby={`reading-${reading.week_start}`}>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Sparkles size={16} aria-hidden="true" />{tr({ en: "Your week, read", pt: "Sua leitura da semana" })}
          </p>
          <h2 id={`reading-${reading.week_start}`} className="font-heading text-lg font-semibold">{title}</h2>
        </div>
        {body}
      </section>
    );
  }
  return (
    <details className="group rounded-xl border border-border bg-card px-4 py-2">
      <summary className="flex min-h-10 cursor-pointer items-center font-heading text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {title}
      </summary>
      <div className="pt-3">{body}</div>
    </details>
  );
}

/**
 * On Hoje: the reading of the week that has just closed, for the week after
 * it, closed until she opens it. Every reading lives in Relatórios.
 */
export function LatestReading({ today }: { today: string }) {
  useCheckReading(today);
  const readings = useReadings();
  const latest = readings.data?.[0];
  if (!latest || latest.week_start < addDays(mondayOf(today), -7)) return null;
  return <ReadingCard reading={latest} collapsible />;
}

/** In Relatórios: every reading, the newest open. */
export function AllReadings() {
  const readings = useReadings();
  const list = readings.data ?? [];
  if (!list.length) return null;
  return (
    <section className="space-y-3" aria-labelledby="all-readings">
      <h2 id="all-readings" className="font-heading text-lg font-semibold">{tr({ en: "Your weekly readings", pt: "Suas leituras da semana" })}</h2>
      {list.map((r, i) => <ReadingCard key={r.week_start} reading={r} open={i === 0} />)}
    </section>
  );
}
