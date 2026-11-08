import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2, Smartphone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { tr } from "../i18n";
import { diaryDb, useDiarySession } from "./db";
import { diary, diaryErrorText, PROFILE_KEY } from "./diary";
import DeleteAccount from "./DeleteAccount";
import { InstallSteps } from "./Install";
import { useInstall } from "./pwa";
import LanguageSwitch from "../i18n/LanguageSwitch";
import { YourData } from "./ImpactChoice";
import Notifications from "./Notifications";
import { OpenDays } from "./BusinessWeek";
import { useTour } from "./tour-steps";

const TIMES = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30; // 06:00 to 22:00, every half hour
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/**
 * On or off, and at what time -- saved as she changes them -- notifications
 * on this phone, the diary on the home screen, her data and her account.
 */
export default function Reminders() {
  const queryClient = useQueryClient();
  const { session } = useDiarySession();
  const tour = useTour();
  const profile = useQuery({ queryKey: [...PROFILE_KEY, "reminders"], queryFn: diary.profile });
  const { installed } = useInstall();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = profile.data?.reminders;
  const on = current?.enabled ?? true;
  const at = current?.remind_at ?? "19:00";

  const save = async (enabled: boolean, time: string) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await diary.setReminders(enabled, time);
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      setSaved(true);
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const card = "space-y-3 rounded-xl border border-border bg-card p-4";
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold leading-tight">{tr({ en: "Reminders", pt: "Lembretes" })}</h1>

      {profile.data && <OpenDays profile={profile.data} />}

      <section data-tour="reminder" className={card} aria-labelledby="reminder-title">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="reminder-title" className="font-heading text-lg font-semibold">{tr({ en: "Daily reminder", pt: "Lembrete diário" })}</h2>
            <p className="text-sm text-muted-foreground">
              {on
                ? tr({ en: `On · every day at ${at}`, pt: `Ligado · todo dia às ${at}` })
                : tr({ en: "Off", pt: "Desligado" })}
            </p>
          </div>
          <Switch id="reminders-on" aria-labelledby="reminder-title" checked={on} disabled={busy || profile.isLoading}
            onCheckedChange={(v) => void save(v, at)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reminders-time">{tr({ en: "Time", pt: "Horário" })}</Label>
          <select id="reminders-time" value={at} disabled={!on || busy} onChange={(e) => void save(on, e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            {(TIMES.includes(at) ? TIMES : [at, ...TIMES]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <p role="status" className="text-sm text-muted-foreground empty:hidden">
          {busy
            ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} aria-hidden="true" />{tr({ en: "Saving…", pt: "Salvando…" })}</span>
            : saved ? tr({ en: "Saved ✅", pt: "Salvo ✅" }) : null}
        </p>
        {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
      </section>

      <Notifications remindersOn={on} />

      <section className={card} aria-labelledby="shortcut-title">
        <div className="flex items-start gap-3">
          <Smartphone size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <div>
              <h2 id="shortcut-title" className="font-heading text-lg font-semibold">{tr({ en: "Home-screen shortcut", pt: "Atalho na tela de início" })}</h2>
              {installed && <p className="text-muted-foreground">{tr({ en: "Already on this phone.", pt: "Já instalado neste celular." })}</p>}
            </div>
            {!installed && <InstallSteps />}
          </div>
        </div>
      </section>

      {profile.data && <YourData profile={profile.data} />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <p className="min-w-0 text-muted-foreground">
          {tr({ en: "Account: ", pt: "Conta: " })}<span className="break-all text-foreground">{session?.user.email}</span>
        </p>
        <button type="button" className="min-h-11 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void diaryDb.auth.signOut().then(() => queryClient.removeQueries({ queryKey: ["diary"] }))}>
          {tr({ en: "Sign out", pt: "Sair" })}
        </button>
      </div>
      <button type="button" data-tour="tour-link" onClick={tour.start}
        className="flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <GraduationCap size={18} aria-hidden="true" />
        {tr({ en: "See the tutorial again", pt: "Ver o tutorial de novo" })}
      </button>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{tr({ en: "Language", pt: "Idioma" })}</span>
        <LanguageSwitch variant="pill" />
      </div>

      <DeleteAccount />
    </div>
  );
}
