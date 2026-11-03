import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { tr } from "../i18n";
import { diaryDb, useDiarySession } from "./db";
import { diary, diaryErrorText, PROFILE_KEY } from "./diary";
import { InstallSteps } from "./Install";
import Notifications from "./Notifications";

const TIMES = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30; // 06:00 to 22:00, every half hour
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** On or off, and at what time; notifications on this phone; the diary on the home screen; signing out. */
export default function Reminders() {
  const queryClient = useQueryClient();
  const { session } = useDiarySession();
  const profile = useQuery({ queryKey: [...PROFILE_KEY, "reminders"], queryFn: diary.profile });
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = profile.data?.reminders;
  const on = enabled ?? current?.enabled ?? true;
  const at = time ?? current?.remind_at ?? "19:00";

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await diary.setReminders(on, at);
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      setSaved(true);
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{tr({ en: "Reminders", pt: "Lembretes" })}</h1>
      <p className="text-muted-foreground">
        {tr({
          en: "One reminder a day, only if the day is not recorded yet. After 7 days without a record, they pause until you come back.",
          pt: "Um lembrete por dia, só se o dia ainda não estiver registrado. Depois de 7 dias sem registro, eles pausam até você voltar.",
        })}
      </p>

      <div className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-border p-3">
        <Label htmlFor="reminders-on" className="text-base">{tr({ en: "Daily reminder", pt: "Lembrete diário" })}</Label>
        <Switch id="reminders-on" checked={on} onCheckedChange={(v) => { setEnabled(v); setSaved(false); }} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reminders-time">{tr({ en: "Time", pt: "Horário" })}</Label>
        <select id="reminders-time" value={at} disabled={!on} onChange={(e) => { setTime(e.target.value); setSaved(false); }}
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
          {(TIMES.includes(at) ? TIMES : [at, ...TIMES]).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <Button className="h-12 w-full" onClick={() => void save()} disabled={busy || profile.isLoading}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {tr({ en: "Save", pt: "Salvar" })}
      </Button>
      {saved && <p role="status" className="text-sm">{tr({ en: "Saved ✅", pt: "Salvo ✅" })}</p>}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

      <Notifications remindersOn={current?.enabled ?? true} />

      <section className="space-y-3 rounded-md border border-border p-4 text-sm">
        <h2 className="text-base font-semibold">{tr({ en: "Diary on the home screen", pt: "Diário na tela de início" })}</h2>
        <InstallSteps />
      </section>

      <section className="space-y-2 border-t border-border pt-5 text-sm">
        {session?.user.email && (
          <p className="text-muted-foreground">
            {tr({ en: "Signed in as ", pt: "Você entrou como " })}<span className="break-all">{session.user.email}</span>
          </p>
        )}
        <Button variant="outline" className="h-11"
          onClick={() => void diaryDb.auth.signOut().then(() => queryClient.removeQueries({ queryKey: ["diary"] }))}>
          {tr({ en: "Sign out", pt: "Sair" })}
        </Button>
      </section>
    </div>
  );
}
