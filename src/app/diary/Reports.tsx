import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "../i18n";
import { ProfitValue } from "./Month";
import { AllReadings } from "./Reading";
import {
  brl, categoryLabel, diary, diaryErrorText, methodLabel, type MonthStatement, type OnTerms, PAYMENT_METHODS, profitLabel,
} from "./diary";

/**
 * Her reports: the month in plain words, not an accountant's statement. One
 * sentence first, then what came in, what went out (variable, fixed, other),
 * what was left before her salary and, after it, the profit or the loss; and
 * her weekly readings. The month counts money as "Seu mês" does, so the two agree.
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
          <h2 id="statement-title" className="font-heading text-lg font-semibold">{tr({ en: "How your month went", pt: "Como foi o seu mês" })}</h2>
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

/**
 * Her expenses in three kinds she can tell apart without accounting words:
 * those that follow her sales (more sales, more of them), those that come every
 * month whether she sells or not, and the rest (equipment, anything without a
 * category). A loan instalment comes every month, so it is fixed.
 */
const KINDS = [
  {
    id: "variable",
    categories: ["stock", "packaging", "fees", "app_fees", "transport"],
    label: { en: "Variable expenses", pt: "Gastos variáveis" },
    hint: { en: "Go up and down with your sales", pt: "Sobem e descem junto com as vendas" },
  },
  {
    id: "fixed",
    categories: ["rent_utilities", "staff", "marketing", "debt"],
    label: { en: "Fixed expenses", pt: "Gastos fixos" },
    hint: { en: "Come every month, whether you sell or not", pt: "Vêm todo mês, vendendo ou não" },
  },
  {
    id: "other",
    categories: ["equipment", "other", null],
    label: { en: "Other expenses", pt: "Outros gastos" },
    hint: { en: "Equipment and what has no category", pt: "Equipamentos e o que ficou sem categoria" },
  },
] as const;

type Kind = (typeof KINDS)[number];
type Lines = MonthStatement["expenses_by_category"];

function Statement({ s, refreshing }: { s: MonthStatement; refreshing: boolean }) {
  const linesOf = (k: Kind): Lines => s.expenses_by_category.filter((e) => (k.categories as readonly (string | null)[]).includes(e.category)
    // A category this screen does not know yet still counts, under "Outros".
    || (k.id === "other" && !KINDS.some((o) => (o.categories as readonly (string | null)[]).includes(e.category))));
  const variable = linesOf(KINDS[0]).reduce((n, e) => n + e.cents, 0);
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
        <>
          <p className="rounded-lg bg-secondary/60 p-3 text-sm">{inShort(s)}</p>

          <div className="space-y-1 text-sm">
            <Heading>{tr({ en: "What came in", pt: "O que entrou" })}</Heading>
            <dl className="space-y-1">
              <Line strong tone="sales" label={tr({ en: "Sales received", pt: "Vendas recebidas" })} cents={s.sales_cents} />
              {methods.map((m) => <Line key={m.id} sub label={methodLabel(m.id)} cents={s.sales_by_method[m.id] ?? 0} />)}
            </dl>

            {s.expenses_cents > 0 && <Heading>{tr({ en: "What went out", pt: "O que saiu" })}</Heading>}
            {KINDS.map((k) => (
              <KindLines key={k.id} kind={k} lines={linesOf(k)}>
                {k.id === "variable" && variable > 0 && s.sales_cents > 0 && (
                  <p className="pl-4 text-xs text-muted-foreground">
                    {tr({
                      en: `Of every R$ 100 you sold, R$ ${per100(variable, s.sales_cents)} went on these.`,
                      pt: `De cada R$ 100 que você vendeu, R$ ${per100(variable, s.sales_cents)} foram para estes gastos.`,
                    })}
                  </p>
                )}
              </KindLines>
            ))}

            <dl className="space-y-1 pt-2">
              <Line total label={tr({ en: "Left before your salary", pt: "Sobrou antes do seu salário" })} cents={s.result_cents} />
              {s.salary_cents !== null && (
                <>
                  <Line minus tone="expense" label={tr({ en: "Your salary for the month", pt: "Seu salário do mês" })} cents={s.salary_cents} />
                  <div className="flex items-baseline justify-between gap-3 border-t-2 border-foreground/20 pt-2">
                    <dt className="font-semibold">{profitLabel(s.profit_cents ?? 0)}</dt>
                    <dd><ProfitValue cents={s.profit_cents ?? 0} className="font-heading text-xl font-semibold" /></dd>
                  </div>
                </>
              )}
            </dl>
            <p className="pt-1 text-xs text-muted-foreground">
              {s.salary_cents !== null
                ? tr({
                  en: "Profit is what is left after every expense and after paying yourself. Your salary is a cost of the business too.",
                  pt: "Lucro é o que sobra depois de todos os gastos e depois de pagar você. O seu salário também é um custo do negócio.",
                })
                : tr({
                  en: "This is not profit yet: your salary is still missing. Enter your monthly salary on Today to see the profit.",
                  pt: "Isso ainda não é lucro: falta tirar o seu salário. Coloque o seu salário mensal na tela Hoje para ver o lucro.",
                })}
            </p>
          </div>
        </>
      )}

      {s.bought_on_terms && <OnTermsBlock kind="expense" t={s.bought_on_terms} complete={s.complete} />}
      {s.sold_on_terms && <OnTermsBlock kind="sale" t={s.sold_on_terms} complete={s.complete} />}

      {(s.taken_home_cents > 0 || s.receivable_cents > 0 || s.payable_cents > 0) && (
        <div className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {s.taken_home_cents > 0 && (
            <>
              <dl><Line plain label={tr({ en: "Taken home (not a cost)", pt: "Retirada para casa (não é gasto)" })} cents={s.taken_home_cents} /></dl>
              <p className="pb-1 text-xs">
                {s.salary_cents !== null
                  ? tr({
                    en: "Money you took from the business for yourself. It is not added to the expenses: what you need to live on is your salary, above.",
                    pt: "Dinheiro que você tirou do negócio para você. Não entra nos gastos: o que você precisa para viver já está no seu salário, lá em cima.",
                  })
                  : tr({
                    en: "Money you took from the business for yourself. It is not added to the expenses: what you need to live on is counted by your monthly salary.",
                    pt: "Dinheiro que você tirou do negócio para você. Não entra nos gastos: o que você precisa para viver entra pelo seu salário mensal.",
                  })}
              </p>
            </>
          )}
          <dl className="space-y-1">
          {s.receivable_cents > 0 && <Line plain label={s.complete
            ? tr({ en: "Still to receive, in later months", pt: "A receber nos próximos meses" })
            : tr({ en: "Still to receive, after today", pt: "A receber depois de hoje" })} cents={s.receivable_cents} />}
          {s.payable_cents > 0 && <Line plain label={s.complete
            ? tr({ en: "Still to pay, in later months", pt: "A pagar nos próximos meses" })
            : tr({ en: "Still to pay, after today", pt: "A pagar depois de hoje" })} cents={s.payable_cents} />}
          </dl>
        </div>
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

/** "R$ 38": a share of R$ 100, whole reais. */
const per100 = (part: number, whole: number) => String(Math.round((part / whole) * 100));

/** The month in one sentence, before the lines: sold, spent, and what was left. */
function inShort(s: MonthStatement): string {
  const sold = brl(s.sales_cents);
  const spent = brl(s.expenses_cents);
  if (s.profit_cents !== null && s.salary_cents !== null) {
    return s.profit_cents >= 0
      ? tr({
        en: `You sold ${sold} and spent ${spent} on the business. After your salary of ${brl(s.salary_cents)}, ${brl(s.profit_cents)} was left as profit.`,
        pt: `Você vendeu ${sold} e gastou ${spent} no negócio. Depois do seu salário de ${brl(s.salary_cents)}, sobrou ${brl(s.profit_cents)} de lucro.`,
      })
      : tr({
        en: `You sold ${sold} and spent ${spent} on the business. With your salary of ${brl(s.salary_cents)}, ${brl(-s.profit_cents)} was missing: a loss.`,
        pt: `Você vendeu ${sold} e gastou ${spent} no negócio. Com o seu salário de ${brl(s.salary_cents)}, faltaram ${brl(-s.profit_cents)}: um prejuízo.`,
      });
  }
  return s.result_cents >= 0
    ? tr({
      en: `You sold ${sold} and spent ${spent} on the business: ${brl(s.result_cents)} was left before your salary.`,
      pt: `Você vendeu ${sold} e gastou ${spent} no negócio: sobraram ${brl(s.result_cents)} antes do seu salário.`,
    })
    : tr({
      en: `You sold ${sold} and spent ${spent} on the business: the expenses were ${brl(-s.result_cents)} more than the sales.`,
      pt: `Você vendeu ${sold} e gastou ${spent} no negócio: os gastos passaram as vendas em ${brl(-s.result_cents)}.`,
    });
}

function Heading({ children }: { children: string }) {
  return <h3 className="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">{children}</h3>;
}

/** One kind of expense: its total, what it means in a few words, and each category in it. */
function KindLines({ kind, lines, children }: { kind: Kind; lines: Lines; children?: ReactNode }) {
  if (!lines.length) return null;
  return (
    <div className="space-y-1 pt-1">
      <dl className="space-y-1">
        <Line minus tone="expense" label={tr(kind.label)} cents={lines.reduce((n, e) => n + e.cents, 0)} />
      </dl>
      <p className="pl-4 text-xs text-muted-foreground">{tr(kind.hint)}</p>
      <dl className="space-y-1">
        {lines.map((e) => (
          <Line key={e.category ?? "none"} sub label={e.category ? categoryLabel(e.category) : tr({ en: "No category", pt: "Sem categoria" })} cents={e.cents} />
        ))}
      </dl>
      {children}
    </div>
  );
}

/**
 * What she bought (or sold) in the month in instalments or to pay later: the whole
 * amount, and how it splits between this month's statement and later ones, so a
 * purchase whose instalments fall due later does not look missing.
 */
function OnTermsBlock({ kind, t, complete }: { kind: "sale" | "expense"; t: OnTerms; complete: boolean }) {
  const buy = kind === "expense";
  return (
    <dl className="space-y-1 rounded-lg bg-secondary/60 p-3 text-sm">
      <Line tone={buy ? "expense" : "sales"} label={buy
        ? tr({ en: `Bought in instalments or to pay later (${t.lines})`, pt: `Compras parceladas ou a prazo (${t.lines})` })
        : tr({ en: `Sold in instalments or to receive later (${t.lines})`, pt: `Vendas parceladas ou a prazo (${t.lines})` })} cents={t.total_cents} />
      <Line sub label={buy
        ? tr({ en: "In this month's expenses", pt: "Entram nos gastos deste mês" })
        : tr({ en: "In this month's sales", pt: "Entram nas vendas deste mês" })} cents={t.in_month_cents} />
      <Line sub label={complete
        ? tr({ en: "Fall due in later months", pt: "Vencem nos próximos meses" })
        : tr({ en: "Fall due after today", pt: "Vencem depois de hoje" })} cents={t.later_cents} />
    </dl>
  );
}

/**
 * One row of the statement. Sales in blue, costs in orange, a subtotal green when it is a
 * profit and red when it is a loss. A sub-row is indented and quieter; a total has a rule above it.
 */
function Line({ label, cents, strong, sub, total, minus, plain, tone }: {
  label: string; cents: number; strong?: boolean; sub?: boolean; total?: boolean; minus?: boolean; plain?: boolean; tone?: "sales" | "expense";
}) {
  const color = tone === "sales" ? "text-sales" : tone === "expense" ? "text-expense" : "";
  if (total) {
    return (
      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
        <dt className="font-semibold">= {label}</dt>
        <dd className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${cents < 0 ? "text-alert" : "text-positive"}`}>{cents < 0 ? `−${brl(-cents)}` : brl(cents)}</dd>
      </div>
    );
  }
  return (
    <div className={`flex items-baseline justify-between gap-3 ${sub ? "pl-4 text-muted-foreground" : ""}`}>
      <dt className={`${strong || (!sub && !plain) ? "font-medium" : ""} ${sub || plain ? "" : color}`}>
        {minus && !sub && <span aria-hidden="true">− </span>}{label}
      </dt>
      <dd className={`shrink-0 whitespace-nowrap tabular-nums ${sub || plain ? "" : `font-semibold ${color}`}`}>{brl(cents)}</dd>
    </div>
  );
}
