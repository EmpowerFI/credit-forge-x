import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { tr } from "../i18n";
import {
  AI_TOLD_IN, diary, diaryErrorText, type DiaryProfile, IMPACT_ASKED_IN, openDaysOf, PROFILE_KEY, WEEKDAYS, weekdayLetters, weekdayNames,
} from "./diary";

/**
 * "Em que dias seu negócio abre?": the base of her week. Each tap saves; the
 * last open day cannot be taken away.
 */
export function OpenDays({ profile }: { profile: DiaryProfile }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = new Set(openDaysOf(profile));
  const letters = weekdayLetters();
  const names = weekdayNames();

  const toggle = async (d: number) => {
    const next = new Set(open);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    if (next.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await diary.setOpenDays([...next].sort());
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-tour="open-days" className="space-y-3 rounded-xl border border-border bg-card p-4" aria-labelledby="open-days-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="open-days-title" className="font-heading text-lg font-semibold">
          {tr({ en: "Days your business opens", pt: "Dias em que seu negócio abre" })}
        </h2>
        {busy && <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Saving", pt: "Salvando" })} />}
      </div>
      <div role="group" aria-label={tr({ en: "Days your business opens", pt: "Dias em que seu negócio abre" })} className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => {
          const on = open.has(d);
          return (
            <button key={d} type="button" aria-pressed={on} aria-label={names[d - 1]} title={names[d - 1]}
              disabled={busy || (on && open.size === 1)} onClick={() => void toggle(d)}
              className={`flex h-10 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
              {letters[d - 1]}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </section>
  );
}

/** What the AI does in the reading, the same words in the consent, the notice and the switch. */
export function AiReadingText() {
  return (
    <>
      {tr({
        en: "Weekly reading written by AI: Anthropic's AI writes it from your figures and your business sector. It never receives your name, e-mail or city, and every number is checked against yours. Off, the reading is made of fixed sentences, and nothing is sent to the AI.",
        pt: "Leitura da semana escrita por IA: a IA da Anthropic escreve a leitura a partir dos seus valores e do ramo do seu negócio. Ela nunca recebe seu nome, e-mail ou cidade, e cada número é conferido com os seus. Desligada, a leitura sai com frases prontas, e nada vai para a IA.",
      })}
    </>
  );
}

function useAiChoice(profile: DiaryProfile) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Saves the choice and records that she read the current wording. */
  const choose = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await diary.setAiReading(on);
      await diary.setImpactConsent(profile.impact_consent?.share ?? false);
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { choose, busy, error };
}

/**
 * Told once, on Hoje, to whoever agreed to a wording that did not mention the
 * AI. Either answer records that she read it; the switch under Lembretes
 * changes it later.
 */
export function AiNotice({ profile }: { profile: DiaryProfile }) {
  const { choose, busy, error } = useAiChoice(profile);
  const version = profile.impact_consent?.text_version;
  // Not while the impact question, which comes first, is still to be asked.
  if (!version || !IMPACT_ASKED_IN.includes(version) || AI_TOLD_IN.includes(version)) return null;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <h2 className="font-heading text-lg font-semibold">{tr({ en: "New: your week, read", pt: "Novidade: a leitura da sua semana" })}</h2>
      <p>
        {tr({
          en: "After each week with at least 3 days recorded, the diary writes a short reading of your business.",
          pt: "Depois de cada semana com pelo menos 3 dias registrados, o diário escreve uma leitura curta do seu negócio.",
        })}
      </p>
      <p className="text-muted-foreground"><AiReadingText /></p>
      <div className="flex flex-wrap gap-2">
        <Button className="h-11" disabled={busy} onClick={() => void choose(true)}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {tr({ en: "OK, with AI", pt: "Ok, com IA" })}
        </Button>
        <Button variant="outline" className="h-11" disabled={busy} onClick={() => void choose(false)}>
          {tr({ en: "I prefer without AI", pt: "Prefiro sem IA" })}
        </Button>
      </div>
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </section>
  );
}

/** Under Lembretes: the AI switch, a short label, and the whole wording a tap away. */
export function AiReadingSwitch({ profile }: { profile: DiaryProfile }) {
  const { choose, busy, error } = useAiChoice(profile);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="ai-reading" className="text-sm font-medium">{tr({ en: "Weekly reading written by AI", pt: "Leitura da semana escrita por IA" })}</Label>
        <Switch id="ai-reading" checked={profile.ai_reading ?? true} disabled={busy} onCheckedChange={(v) => void choose(v)} className="shrink-0" />
      </div>
      <details className="text-sm text-muted-foreground">
        <summary className="min-h-8 cursor-pointer underline underline-offset-4">{tr({ en: "What this means", pt: "O que isso significa" })}</summary>
        <p className="pt-1 leading-relaxed"><AiReadingText /></p>
      </details>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
