import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, TrendingDown, TrendingUp } from "lucide-react";
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
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      {signedBrl(cents)}
    </span>
  );
}

/** "Coloque aqui o seu salário mensal": asked once, changed whenever she likes. */
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
          onChange={(e) => setValue(e.target.value)} className="h-11 text-base" aria-invalid={error !== null} />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" className="h-11" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {tr({ en: "Save", pt: "Salvar" })}
        </Button>
        <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onLater ?? onDone}>
          {onLater ? tr({ en: "Not now", pt: "Agora não" }) : tr({ en: "Cancel", pt: "Cancelar" })}
        </Button>
      </div>
    </form>
  );
}

/**
 * One line of the month's sum: a label and an amount, with the sign it carries
 * in the sum. Sales in blue, expenses in orange, each with a dot beside the
 * word, so the colour is never the only thing that tells them apart.
 */
function SumLine({ label, cents, sign, tone }: { label: string; cents: number; sign?: "−"; tone?: "sales" | "expense" }) {
  const color = tone === "sales" ? "text-sales" : tone === "expense" ? "text-expense" : "";
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={`inline-flex items-center gap-1.5 ${tone ? `font-medium ${color}` : "text-muted-foreground"}`}>
        {tone && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${tone === "sales" ? "bg-sales" : "bg-expense"}`} />}
        {sign && <span aria-hidden="true">{sign}</span>}{label}
      </span>
      <span className={`tabular-nums ${tone ? `font-semibold ${color}` : ""}`}>{brl(cents)}</span>
    </div>
  );
}

/**
 * The month on Hoje, as a sum she can follow: sales, less the business's
 * expenses, less her pay (what she needs to get through the month), and what
 * is left -- profit, or a loss in red. A bar shows how much of that whole
 * cost the sales already cover. Until she says what she needs, the card asks.
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
  const question = tr({ en: "Enter your monthly salary here", pt: "Coloque aqui o seu salário mensal" });

  if (askNow || editing) {
    return (
      <section data-tour="month" className="space-y-3 rounded-xl border-2 border-primary/30 bg-card p-4" aria-labelledby="need-title">
        <h2 id="need-title" className="font-heading text-lg font-semibold">{question}</h2>
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

  const leftBeforePay = m.sales_cents - m.expenses_cents;

  return (
    <section data-tour="month" className="space-y-3 rounded-xl border border-border bg-card p-4" aria-labelledby="month-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="month-title" className="font-heading text-lg font-semibold">{tr({ en: "Your month", pt: "Seu mês" })}</h2>
        <span className="text-sm capitalize text-muted-foreground">{monthName}</span>
      </div>

      <div className="space-y-1.5">
        <SumLine tone="sales" label={tr({ en: "Sales", pt: "Vendas" })} cents={m.sales_cents} />
        <SumLine tone="expense" sign="−" label={tr({ en: "Business expenses", pt: "Gastos do negócio" })} cents={m.expenses_cents} />
        {be && <SumLine sign="−" label={tr({ en: "Your salary for the month", pt: "Seu salário do mês" })} cents={be.need} />}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
          <span className="font-semibold">
            {be
              ? tr({ en: `${profitLabel(be.profit)} so far`, pt: `${profitLabel(be.profit)} até agora` })
              : tr({ en: "Left before your salary", pt: "Sobra antes do seu salário" })}
          </span>
          {be
            ? <ProfitValue cents={be.profit} className="font-heading text-xl font-semibold" />
            : <span className="font-heading text-xl font-semibold tabular-nums">{signedBrl(leftBeforePay)}</span>}
        </div>
      </div>

      {be ? (
        <>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(be.covered * 100)}
            aria-label={tr({ en: "Sales towards the month's costs", pt: "Vendas rumo aos custos do mês" })}
            className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className={`h-full rounded-full ${be.missing === 0 ? "bg-positive" : "bg-sales"}`} style={{ width: `${be.covered * 100}%` }} />
          </div>
          <Button variant="outline" size="sm" className="h-10 w-full" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            {tr({ en: "Change your salary", pt: "Alterar o seu salário" })}
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="h-10 w-full" onClick={() => setEditing(true)}>
          {tr({ en: "Set your monthly salary", pt: "Definir seu salário do mês" })}
        </Button>
      )}
    </section>
  );
}
