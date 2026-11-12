import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { tr } from "../i18n";
import { addDays, diary, mondayOf, type WeekReading, weekSpan } from "./diary";

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

/**
 * One week's tip, and nothing else (since 13/11/2026): a word of praise or a place to
 * improve, and one small action. A reading written before then shows its action,
 * which was its tip. The newest is open; older ones open on a tap.
 */
export function ReadingCard({ reading, open = true }: { reading: WeekReading; open?: boolean }) {
  const r = reading.report;
  const raw = (r.tip ?? r.action).trim();
  const tip = raw.charAt(0).toUpperCase() + raw.slice(1);
  const title = tr({ en: `Week of ${weekSpan(reading.week_start)}`, pt: `Semana de ${weekSpan(reading.week_start)}` });
  const body = (
    <div className="space-y-2">
      <p className="flex gap-2 text-base leading-relaxed">
        <Lightbulb size={18} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
        <span>{tip}</span>
      </p>
      {reading.source === "model" && <p className="text-xs text-muted-foreground">{tr({ en: "Written by AI.", pt: "Escrita por IA." })}</p>}
    </div>
  );

  if (open) {
    return (
      <section className="space-y-2 rounded-xl border-2 border-primary/30 bg-card p-4" aria-labelledby={`reading-${reading.week_start}`}>
        <p id={`reading-${reading.week_start}`} className="text-sm font-medium text-muted-foreground">
          {tr({ en: "Tip of the week", pt: "Dica da semana" })} · {title}
        </p>
        {body}
      </section>
    );
  }
  return (
    <details className="group rounded-xl border border-border bg-card px-4 py-2">
      <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {title}
      </summary>
      <div className="pt-2 pb-1">{body}</div>
    </details>
  );
}

/**
 * On Hoje: the reading of the week that has just closed, for the week after
 * it: just the tip, short enough to stay open. Every tip lives in Relatórios.
 */
export function LatestReading({ today }: { today: string }) {
  useCheckReading(today);
  const readings = useReadings();
  const latest = readings.data?.[0];
  if (!latest || latest.week_start < addDays(mondayOf(today), -7)) return null;
  return <ReadingCard reading={latest} />;
}

/** In Relatórios: every reading, the newest open. */
export function AllReadings() {
  const readings = useReadings();
  const list = readings.data ?? [];
  if (!list.length) return null;
  return (
    <section className="space-y-3" aria-labelledby="all-readings">
      <h2 id="all-readings" className="font-heading text-lg font-semibold">{tr({ en: "Your weekly tips", pt: "Suas dicas da semana" })}</h2>
      {list.map((r, i) => <ReadingCard key={r.week_start} reading={r} open={i === 0} />)}
    </section>
  );
}
