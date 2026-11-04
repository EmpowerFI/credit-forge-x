import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import { addDays, diary, diaryErrorText, type HistoryDay, mondayOf, PROGRESS_EMOJIS, PROFILE_KEY } from "./diary";

const LETTERS = { en: ["M", "T", "W", "T", "F", "S", "S"], pt: ["S", "T", "Q", "Q", "S", "S", "D"] };
const NAMES = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  pt: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"],
};

/**
 * Her week, Monday to Sunday, with her own emoji on every day she recorded.
 * Playful on purpose; the count is written too, so it never rests on the
 * picture alone.
 */
export function WeekProgress({ emoji, today, days }: { emoji: string; today: string; days: HistoryDay[] }) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = mondayOf(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const recorded = new Set(days.map((d) => d.day));
  const kept = week.filter((d) => recorded.has(d)).length;
  const letters = tr({ en: LETTERS.en.join(""), pt: LETTERS.pt.join("") }).split("");
  const names = tr({ en: NAMES.en.join(","), pt: NAMES.pt.join(",") }).split(",");

  const pick = async (e: string) => {
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
    <section className="space-y-3 rounded-md border border-border p-4" aria-labelledby="week-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="week-title" className="text-base font-semibold">{tr({ en: "Your week", pt: "Sua semana" })}</h2>
        <Button variant="ghost" size="sm" className="h-10" aria-expanded={picking} onClick={() => setPicking(!picking)}>
          {tr({ en: `Change ${emoji}`, pt: `Trocar ${emoji}` })}
        </Button>
      </div>
      <ol className="grid grid-cols-7 gap-1 text-center">
        {week.map((d, i) => {
          const done = recorded.has(d);
          const future = d > today;
          return (
            <li key={d} className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground" aria-hidden="true">{letters[i]}</span>
              <span
                aria-label={`${names[i]}: ${done ? tr({ en: "recorded", pt: "registrado" }) : future ? tr({ en: "still to come", pt: "ainda vai chegar" }) : tr({ en: "not recorded", pt: "sem registro" })}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${
                  done ? "bg-primary/10" : d === today ? "border-2 border-dashed border-primary/50" : future ? "opacity-40" : "border border-border"}`}>
                {done ? emoji : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm">
        {kept === 1
          ? tr({ en: "1 of 7 days recorded this week.", pt: "1 de 7 dias registrados nesta semana." })
          : tr({ en: `${kept} of 7 days recorded this week.`, pt: `${kept} de 7 dias registrados nesta semana.` })}
      </p>
      {picking && (
        <div role="group" aria-label={tr({ en: "Choose your emoji", pt: "Escolha o seu emoji" })} className="grid grid-cols-6 gap-2">
          {PROGRESS_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => void pick(e)} aria-pressed={e === emoji}
              className={`flex h-12 items-center justify-center rounded-md border text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                e === emoji ? "border-primary bg-primary/10" : "border-border"}`}>
              {e}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </section>
  );
}
