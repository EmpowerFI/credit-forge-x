import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "../i18n";
import { ProfitValue } from "./Month";
import { AllReadings } from "./Reading";
import {
  brl, categoryLabel, diary, diaryErrorText, methodLabel, type MonthStatement, PAYMENT_METHODS, profitLabel,
} from "./diary";

/**
 * Her reports: the month laid out like a DRE (an income statement), so she
 * sees where the money came from and what each kind of expense took, and her
 * weekly readings. The month counts money as "Seu mês" does, so the two agree.
 */
export default function Reports() {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  // Under ["diary", "history"]: whatever refreshes her days after a record refreshes this too.
  const statement = useQuery({ queryKey: ["diary", "history", "statement", period ?? "now"], queryFn: () => diary.statement(period) });
  const s = statement.data;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold leading-tight">{tr({ en: "Reports", pt: "Relatórios" })}</h1>

      <section className="space-y-3" aria-labelledby="statement-title" aria-busy={statement.isFetching}>
        <div className="flex items-end justify-between gap-3">
          <h2 id="statement-title" className="font-heading text-lg font-semibold">{tr({ en: "Your month's result", pt: "Resultado do mês" })}</h2>
          {s && s.months.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="statement-month" className="sr-only">{tr({ en: "Month", pt: "Mês" })}</Label>
              <select id="statement-month" value={s.period} onChange={(e) => setPeriod(e.target.value)}
                className="h-10 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {s.months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
              </select>
            </div>
          )}
        </div>

        {statement.isLoading && <Skeleton className="h-80 w-full" />}
        {statement.error && (
          <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
            <p>{diaryErrorText(statement.error)}</p>
            <Button variant="outline" className="h-11" onClick={() => void statement.refetch()}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
          </div>
        )}
        {s && <Statement s={s} refreshing={statement.isFetching && !statement.isLoading} />}
      </section>

      <AllReadings />
    </div>
  );
}

/** "Outubro de 2026": only the first letter capitalised, so "de" stays lower case. */
function monthName(period: string) {
  const name = new Date(`${period}-01T12:00:00Z`).toLocaleDateString(tr({ en: "en-GB", pt: "pt-BR" }), { month: "long", year: "numeric", timeZone: "UTC" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const GROUPS = [
  { id: "cogs", label: { en: "Cost of goods", pt: "Custo da mercadoria" } },
  { id: "opex", label: { en: "Running costs", pt: "Despesas do negócio" } },
  { id: "staff", label: { en: "Staff", pt: "Pessoal" } },
  { id: "investment", label: { en: "Equipment", pt: "Equipamentos" } },
  { id: "financing", label: { en: "Loans and debts", pt: "Empréstimos e dívidas" } },
] as const;

function Statement({ s, refreshing }: { s: MonthStatement; refreshing: boolean }) {
  const byGroup = (g: string | null) => s.expenses_by_category.filter((e) => (e.group ?? "opex") === g);
  const total = (g: string) => byGroup(g).reduce((n, e) => n + e.cents, 0);
  const cogs = total("cogs");
  const methods = PAYMENT_METHODS.filter((m) => (s.sales_by_method[m.id] ?? 0) > 0);
  const empty = s.sales_cents === 0 && s.expenses_cents === 0;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{monthName(s.period)}</span>
        {!s.complete && <span>· {tr({ en: "so far", pt: "até hoje" })}</span>}
        · {s.days_kept === 1 ? tr({ en: "1 day recorded", pt: "1 dia registrado" }) : tr({ en: `${s.days_kept} days recorded`, pt: `${s.days_kept} dias registrados` })}
        {refreshing && <Loader2 size={14} className="animate-spin" aria-label={tr({ en: "Updating", pt: "Atualizando" })} />}
      </p>

      {empty ? (
        <p className="py-4 text-sm text-muted-foreground">{tr({ en: "No sales or expenses this month.", pt: "Nenhuma venda ou gasto neste mês." })}</p>
      ) : (
        <dl className="space-y-1 text-sm">
          <Line strong tone="sales" label={tr({ en: "Sales received", pt: "Vendas recebidas" })} cents={s.sales_cents} />
          {methods.map((m) => <Line key={m.id} sub label={methodLabel(m.id)} cents={s.sales_by_method[m.id] ?? 0} />)}

          {cogs > 0 && (
            <>
              <Group id="cogs" byGroup={byGroup} />
              <Line total label={tr({ en: "Gross profit", pt: "Lucro bruto" })} cents={s.sales_cents - cogs} />
            </>
          )}
          {GROUPS.filter((g) => g.id !== "cogs").map((g) => <Group key={g.id} id={g.id} byGroup={byGroup} />)}

          <Line total label={tr({ en: "The business's result", pt: "Resultado do negócio" })} cents={s.result_cents} />
          {s.salary_cents !== null ? (
            <>
              <Line minus label={tr({ en: "Your monthly salary", pt: "Seu salário do mês" })} cents={s.salary_cents} />
              <div className="flex items-baseline justify-between gap-3 border-t-2 border-foreground/20 pt-2">
                <dt className="font-semibold">{profitLabel(s.profit_cents ?? 0)}</dt>
                <dd><ProfitValue cents={s.profit_cents ?? 0} className="font-heading text-xl font-semibold" /></dd>
              </div>
            </>
          ) : (
            <p className="pt-1 text-xs text-muted-foreground">
              {tr({ en: "Enter your monthly salary on Today to see the profit.", pt: "Coloque o seu salário mensal na tela Hoje para ver o lucro." })}
            </p>
          )}
        </dl>
      )}

      {(s.taken_home_cents > 0 || s.receivable_cents > 0 || s.payable_cents > 0) && (
        <dl className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {s.taken_home_cents > 0 && <Line plain label={tr({ en: "Taken home (not a cost)", pt: "Retirada para casa (não é gasto)" })} cents={s.taken_home_cents} />}
          {s.receivable_cents > 0 && <Line plain label={tr({ en: "Still to receive, in later months", pt: "A receber nos próximos meses" })} cents={s.receivable_cents} />}
          {s.payable_cents > 0 && <Line plain label={tr({ en: "Still to pay, in later months", pt: "A pagar nos próximos meses" })} cents={s.payable_cents} />}
        </dl>
      )}
      <p className="text-xs text-muted-foreground">
        {tr({
          en: "Each sale and expense counts when the money comes in or goes out; instalments, in the month each one falls due.",
          pt: "Cada venda e cada gasto contam quando o dinheiro entra ou sai; parcelas, no mês em que cada uma vence.",
        })}
      </p>
    </div>
  );
}

function Group({ id, byGroup }: { id: (typeof GROUPS)[number]["id"]; byGroup: (g: string | null) => MonthStatement["expenses_by_category"] }) {
  const lines = byGroup(id);
  if (!lines.length) return null;
  const group = GROUPS.find((g) => g.id === id)!;
  return (
    <>
      <Line minus tone="expense" label={tr(group.label)} cents={lines.reduce((n, e) => n + e.cents, 0)} />
      {lines.map((e) => (
        <Line key={e.category ?? "none"} sub label={e.category ? categoryLabel(e.category) : tr({ en: "No category", pt: "Sem categoria" })} cents={e.cents} />
      ))}
    </>
  );
}

/** One row of the statement. A sub-row is indented and quieter; a total has a rule above it. */
function Line({ label, cents, strong, sub, total, minus, plain, tone }: {
  label: string; cents: number; strong?: boolean; sub?: boolean; total?: boolean; minus?: boolean; plain?: boolean; tone?: "sales" | "expense";
}) {
  const color = tone === "sales" ? "text-sales" : tone === "expense" ? "text-expense" : "";
  if (total) {
    return (
      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
        <dt className="font-semibold">= {label}</dt>
        <dd className={`font-semibold tabular-nums ${cents < 0 ? "text-alert" : ""}`}>{cents < 0 ? `−${brl(-cents)}` : brl(cents)}</dd>
      </div>
    );
  }
  return (
    <div className={`flex items-baseline justify-between gap-3 ${sub ? "pl-4 text-muted-foreground" : ""}`}>
      <dt className={`${strong || (!sub && !plain) ? "font-medium" : ""} ${sub || plain ? "" : color}`}>
        {minus && !sub && <span aria-hidden="true">− </span>}{label}
      </dt>
      <dd className={`tabular-nums ${sub || plain ? "" : `font-semibold ${color}`}`}>{brl(cents)}</dd>
    </div>
  );
}
