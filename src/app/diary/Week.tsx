import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import {
  addDays, diary, diaryErrorText, type HistoryDay, mondayOf, PROFILE_KEY, PROGRESS_ICONS, type ProgressIcon, progressIconSrc,
  weekdayLetters, weekdayNames,
} from "./diary";

/** One of EmpowerFI's progress icons, decorative: what it stands for is always written beside it. */
function ProgressImg({ code, size }: { code: ProgressIcon; size: number }) {
  return <img src={progressIconSrc(code)} alt="" aria-hidden="true" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />;
}

/**
 * Her week, Monday to Sunday, with her own icon on every day she recorded.
 * Playful on purpose; each day also says in words, to a screen reader,
 * whether it was recorded. Days her business does not open are disabled:
 * there is nothing to record on them, and nothing is missed.
 */
export function WeekProgress({ icon, today, days, openDays }: { icon: ProgressIcon; today: string; days: HistoryDay[]; openDays: number[] }) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = mondayOf(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const recorded = new Set(days.map((d) => d.day));
  const letters = weekdayLetters();
  const names = weekdayNames();
  const opens = new Set(openDays);

  const pick = async (e: ProgressIcon) => {
    setError(null);
    try {
      await diary.setEmoji(e);
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      setPicking(false);
    } catch (err) {
      setError(diaryErrorText(err));
    }
  };

  return (
    <section data-tour="week" className="space-y-2 rounded-xl border border-border bg-card p-4" aria-labelledby="week-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="week-title" className="font-heading text-lg font-semibold">{tr({ en: "Your week", pt: "Sua semana" })}</h2>
        <Button variant="ghost" size="sm" className="h-10 gap-2" aria-expanded={picking} onClick={() => setPicking(!picking)}>
          <ProgressImg code={icon} size={20} />
          {tr({ en: "Change icon", pt: "Trocar ícone" })}
        </Button>
      </div>
      <ol className="grid grid-cols-7 gap-1 text-center">
        {week.map((d, i) => {
          const done = recorded.has(d);
          const future = d > today;
          const closed = !opens.has(i + 1);
          const state = done
            ? tr({ en: "recorded", pt: "registrado" })
            : closed
              ? tr({ en: "closed, nothing to record", pt: "fechado, nada a registrar" })
              : future ? tr({ en: "still to come", pt: "ainda vai chegar" }) : tr({ en: "not recorded", pt: "sem registro" });
          return (
            <li key={d} className={`flex flex-col items-center gap-1 ${closed && !done ? "opacity-40" : ""}`}>
              <span className={`text-xs text-muted-foreground ${closed && !done ? "line-through" : ""}`} aria-hidden="true">{letters[i]}</span>
              <span
                aria-label={`${names[i]}: ${state}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  done ? "bg-primary/10"
                    : closed ? "bg-muted text-muted-foreground"
                      : d === today ? "border-2 border-dashed border-primary/50" : future ? "opacity-40" : "border border-border"}`}>
                {done ? <ProgressImg code={icon} size={26} /> : closed ? <Moon size={14} aria-hidden="true" /> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {picking && (
        <div role="group" aria-label={tr({ en: "Choose your icon", pt: "Escolha o seu ícone" })} className="grid grid-cols-5 gap-2">
          {PROGRESS_ICONS.map((i) => (
            <button key={i.code} type="button" onClick={() => void pick(i.code)} aria-pressed={i.code === icon}
              aria-label={tr(i.label)} title={tr(i.label)}
              className={`flex h-12 items-center justify-center rounded-lg border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                i.code === icon ? "border-primary bg-primary/10" : "border-border"}`}>
              <ProgressImg code={i.code} size={34} />
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </section>
  );
}
