import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
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

/** One reading, as she reads it. */
export function ReadingCard({ reading, open = true }: { reading: WeekReading; open?: boolean }) {
  const r = reading.report;
  const body = (
    <div className="space-y-2 text-sm leading-relaxed">
      <p>{r.summary}</p>
      {r.observations.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {r.observations.map((o) => <li key={o}>{o}</li>)}
        </ul>
      )}
      <p><strong>{tr({ en: "For this week:", pt: "Para esta semana:" })}</strong> {r.action}</p>
      <p className="text-sm italic text-muted-foreground">{r.limits}</p>
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
 * it. Older ones live in the history.
 */
export function LatestReading({ today }: { today: string }) {
  useCheckReading(today);
  const readings = useReadings();
  const latest = readings.data?.[0];
  if (!latest || latest.week_start < addDays(mondayOf(today), -7)) return null;
  return <ReadingCard reading={latest} />;
}

/** In the history: every reading, the newest open. */
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
