import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "../i18n";
import { MyRewards } from "./Campaigns";
import { addDays, brl, categoryLabel, dayName, diary, diaryErrorText, type HistoryEntry, methodLabel, PROFILE_KEY } from "./diary";

/** The last 31 days she kept, newest first. Today's and yesterday's lines can be taken back. */
export default function History() {
  const queryClient = useQueryClient();
  const today = queryClient.getQueriesData<{ today: string }>({ queryKey: PROFILE_KEY })[0]?.[1]?.today
    ?? new Date().toISOString().slice(0, 10);
  const history = useQuery({ queryKey: ["diary", "history", 31], queryFn: () => diary.history(31) });
  const me = useQuery({ queryKey: [...PROFILE_KEY, "reminders"], queryFn: diary.profile });
  const [toVoid, setToVoid] = useState<HistoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voidIt = async () => {
    if (!toVoid) return;
    setBusy(true);
    setError(null);
    try {
      await diary.voidEntry(toVoid.id);
      await queryClient.invalidateQueries({ queryKey: ["diary", "history"] });
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
      setToVoid(null);
    }
  };

  const kept = history.data ?? [];
  const sales = (d: (typeof kept)[number]) => d.entries.filter((e) => !e.voided && e.kind === "sale").reduce((s, e) => s + e.amount_cents, 0);
  const expenses = (d: (typeof kept)[number]) => d.entries.filter((e) => !e.voided && e.kind === "expense").reduce((s, e) => s + e.amount_cents, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{tr({ en: "History", pt: "Histórico" })}</h1>
      <p className="text-sm text-muted-foreground">
        {tr({
          en: `${kept.length} of the last 31 days recorded.`,
          pt: `${kept.length} dos últimos 31 dias registrados.`,
        })}
      </p>
      {me.data && <MyRewards profile={me.data} />}

      {history.isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>}
      {history.error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{diaryErrorText(history.error)}</p>
          <Button variant="outline" onClick={() => void history.refetch()}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
        </div>
      )}
      {history.data && kept.length === 0 && (
        <p className="rounded-md bg-muted p-4 text-sm">
          {tr({ en: "Nothing recorded yet. Your days will show here.", pt: "Nada registrado ainda. Os seus dias aparecem aqui." })}
        </p>
      )}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

      <ul className="space-y-3">
        {kept.map((d) => {
          const correctable = d.day === today || d.day === addDays(today, -1);
          return (
            <li key={d.day} className="rounded-md border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold capitalize">{dayName(d.day, today)}</h2>
                {!d.no_activity && (
                  <span className="text-sm">
                    <span className="text-muted-foreground">{tr({ en: "sold", pt: "vendeu" })}</span> {brl(sales(d))}
                    {" · "}
                    <span className="text-muted-foreground">{tr({ en: "spent", pt: "gastou" })}</span> {brl(expenses(d))}
                  </span>
                )}
              </div>
              {d.no_activity ? (
                <p className="text-sm text-muted-foreground">
                  {d.quiet_reason === "closed"
                    ? tr({ en: "Did not open.", pt: "Não abriu." })
                    : d.quiet_reason === "no_sales"
                      ? tr({ en: "Opened, no sales.", pt: "Abriu e não vendeu." })
                      : tr({ en: "No activity.", pt: "Sem movimento." })}
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {d.entries.map((e) => (
                    <li key={e.id} className={`flex items-center justify-between gap-2 text-sm ${e.voided ? "text-muted-foreground line-through" : ""}`}>
                      <span>
                        {e.kind === "sale" ? "💰" : "💸"} {e.kind === "sale" ? methodLabel(e.payment_method) : categoryLabel(e.category)}
                        {e.kind === "expense" && <span className="text-muted-foreground"> · {methodLabel(e.payment_method)}</span>}
                        {": "}{brl(e.amount_cents)}
                        {e.voided && <span className="sr-only">{tr({ en: " (taken back)", pt: " (desfeito)" })}</span>}
                      </span>
                      {correctable && !e.voided && (
                        <Button variant="ghost" size="sm" className="h-10" onClick={() => setToVoid(e)}
                          aria-label={tr({ en: "Take this line back", pt: "Desfazer este lançamento" })}>
                          <Undo2 aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={toVoid !== null} onOpenChange={(open) => { if (!open) setToVoid(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr({ en: "Take this line back?", pt: "Desfazer este lançamento?" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {toVoid && `${toVoid.kind === "sale" ? methodLabel(toVoid.payment_method) : categoryLabel(toVoid.category)}: ${brl(toVoid.amount_cents)}. `}
              {tr({
                en: "It stops counting in your totals. If it was wrong, record it again with the right amount.",
                pt: "Ele deixa de contar nos seus totais. Se estava errado, registre de novo com o valor certo.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr({ en: "Keep it", pt: "Manter" })}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void voidIt()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {tr({ en: "Take it back", pt: "Desfazer" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
