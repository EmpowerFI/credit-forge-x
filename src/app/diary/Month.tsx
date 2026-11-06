import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr } from "../i18n";
import { breakEven, brl, diary, diaryErrorText, MONTH_KEY, parseReais, profitLabel, signedBrl } from "./diary";

const DISMISS_KEY = "empowerfi-diary-need-later";
const dismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    return false;
  }
};

/**
 * A profit or a loss, never by colour alone: the word ("Lucro" or
 * "Prejuízo"), the sign, an arrow, and green or red.
 */
export function ProfitValue({ cents, className = "" }: { cents: number; className?: string }) {
  const loss = cents < 0;
  const Icon = loss ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${loss ? "text-alert" : "text-positive"} ${className}`}>
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      {signedBrl(cents)}
    </span>
  );
}

/** "Quanto você precisa para passar o mês?": asked once, changed whenever she likes. */
function NeedForm({ current, onDone, onLater }: { current: number | null; onDone: () => void; onLater?: () => void }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(current ? (current / 100).toFixed(2).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const cents = parseReais(value);
    if (cents === null) {
      setError(tr({ en: "Write the amount, for example 2.000.", pt: "Escreva o valor, por exemplo 2.000." }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await diary.setMonthlyNeed(cents);
      await queryClient.invalidateQueries({ queryKey: MONTH_KEY });
      onDone();
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="space-y-1">
        <Label htmlFor="monthly-need">{tr({ en: "Amount a month (R$)", pt: "Valor por mês (R$)" })}</Label>
        <Input id="monthly-need" inputMode="decimal" autoComplete="off" placeholder="2.000,00" value={value}
          onChange={(e) => setValue(e.target.value)} className="h-12 text-base" aria-invalid={error !== null} />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" className="h-12" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {tr({ en: "Save", pt: "Salvar" })}
        </Button>
        <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={onLater ?? onDone}>
          {onLater ? tr({ en: "Not now", pt: "Agora não" }) : tr({ en: "Cancel", pt: "Cancelar" })}
        </Button>
      </div>
    </form>
  );
}

/**
 * The month on Hoje: its profit (or loss), and how far it has come towards
 * what she needs to get through the month -- her pay, which the business has
 * to earn. Until she says that amount, the card asks for it.
 */
export function MonthCard({ openDays, todayKept }: { openDays: number[]; todayKept: boolean }) {
  const month = useQuery({ queryKey: MONTH_KEY, queryFn: diary.month });
  const [editing, setEditing] = useState(false);
  const [later, setLater] = useState(dismissed);
  const m = month.data;
  if (!m) return null;

  const monthName = new Date(`${m.first_day}T12:00:00Z`).toLocaleDateString(tr({ en: "en-GB", pt: "pt-BR" }), { month: "long", timeZone: "UTC" });
  const be = breakEven(m, openDays, todayKept);
  const askNow = m.monthly_need_cents === null && !later;
  const explain = tr({
    en: "It is what you take from the business for the household bills: your pay. It is a cost of the business too, and the profit has to cover it.",
    pt: "É o que você tira do negócio para as contas da casa: o seu pró-labore. Ele também é um custo do negócio, e o lucro precisa cobrir esse valor.",
  });

  if (askNow || editing) {
    return (
      <section data-tour="month" className="space-y-3 rounded-2xl border-2 border-primary/30 bg-card p-5" aria-labelledby="need-title">
        <h2 id="need-title" className="font-heading text-xl font-semibold">
          {tr({ en: "How much do you need to get through the month?", pt: "Quanto você precisa para passar o mês?" })}
        </h2>
        <p className="text-sm text-muted-foreground">{explain}</p>
        <NeedForm current={m.monthly_need_cents} onDone={() => setEditing(false)}
          onLater={askNow ? () => {
            try {
              localStorage.setItem(DISMISS_KEY, new Date().toISOString());
            } catch {
              // Memory only.
            }
            setLater(true);
          } : undefined} />
      </section>
    );
  }

  return (
    <section data-tour="month" className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="month-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="month-title" className="font-heading text-xl font-semibold">{tr({ en: "Your month", pt: "Seu mês" })}</h2>
        <span className="text-sm capitalize text-muted-foreground">{monthName}</span>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">{tr({ en: `${profitLabel(m.profit_cents)} so far`, pt: `${profitLabel(m.profit_cents)} do mês até agora` })}</p>
        <ProfitValue cents={m.profit_cents} className="font-heading text-3xl font-semibold" />
        <p className="mt-1 text-sm text-muted-foreground">
          {tr({ en: "Sales", pt: "Vendas" })} {brl(m.sales_cents)} − {tr({ en: "business expenses", pt: "gastos do negócio" })} {brl(m.expenses_cents)}
        </p>
      </div>

      {be ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>{tr({ en: "What you need for the month", pt: "O que você precisa no mês" })}</span>
            <span className="font-semibold tabular-nums">{brl(be.need)}</span>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(be.covered * 100)}
            aria-label={tr({ en: "Profit towards what you need", pt: "Lucro rumo ao que você precisa" })}
            className="h-3 overflow-hidden rounded-full bg-secondary">
            <div className={`h-full rounded-full ${be.covered >= 1 ? "bg-positive" : "bg-primary"}`} style={{ width: `${be.covered * 100}%` }} />
          </div>
          <p className="text-sm">
            {be.missing === 0
              ? <span className="font-medium text-positive">
                {be.surplus > 0
                  ? tr({ en: `You have covered what you need, with ${brl(be.surplus)} to spare.`, pt: `Você já cobriu o que precisa, e tem ${brl(be.surplus)} a mais.` })
                  : tr({ en: "You have covered exactly what you need.", pt: "Você cobriu exatamente o que precisa." })}
              </span>
              : tr({
                en: `${brl(be.missing)} of profit still to go (${Math.round(be.covered * 100)}% covered).`,
                pt: `Faltam ${brl(be.missing)} de lucro (${Math.round(be.covered * 100)}% coberto).`,
              })}
          </p>
          {be.perOpenDay !== null && (
            <p className="text-sm text-muted-foreground">
              {be.openDaysLeft === 1
                ? tr({ en: `To get there: ${brl(be.perOpenDay)} of profit on the 1 open day left.`, pt: `Para chegar lá: ${brl(be.perOpenDay)} de lucro no 1 dia aberto que falta.` })
                : tr({
                  en: `To get there: ${brl(be.perOpenDay)} of profit a day, on the ${be.openDaysLeft} open days left.`,
                  pt: `Para chegar lá: ${brl(be.perOpenDay)} de lucro por dia, nos ${be.openDaysLeft} dias abertos que faltam.`,
                })}
            </p>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className="min-h-11 text-left font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {tr({ en: "How much do you need to get through the month?", pt: "Quanto você precisa para passar o mês?" })}
        </button>
      )}

      {m.taken_home_cents > 0 && (
        <p className={`rounded-md p-3 text-sm ${m.taken_home_cents > Math.max(0, m.profit_cents) ? "tone-alert border" : "bg-muted"}`}>
          {tr({ en: `Taken home this month: ${brl(m.taken_home_cents)}.`, pt: `Retirado para casa no mês: ${brl(m.taken_home_cents)}.` })}
          {m.taken_home_cents > Math.max(0, m.profit_cents) && tr({
            en: " That is more than the business has made in profit so far.",
            pt: " É mais do que o negócio lucrou até agora.",
          })}
        </p>
      )}

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        {tr({
          en: "Profit = sales − business expenses. Taking home does not count: it is your pay, and it comes out of the profit.",
          pt: "Lucro = vendas − gastos do negócio. A retirada para casa não entra: ela é o seu pró-labore, que sai do lucro.",
        })}
        {be && (
          <>
            {" "}
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {tr({ en: "Change what you need", pt: "Alterar quanto preciso" })}
            </button>
          </>
        )}
      </p>
    </section>
  );
}
