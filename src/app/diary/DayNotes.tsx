import { tr } from "../i18n";
import { brl, categoryLabel, type FallingDue, type HistoryDay, methodLabel } from "./diary";

const dm = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

/** "Parcela 1/3 de venda", or "Venda recebida hoje" when it was a single payment later. */
function title(f: FallingDue): string {
  if (f.installments > 1) {
    return f.kind === "sale"
      ? tr({ en: `Sale instalment ${f.instalment}/${f.installments}`, pt: `Parcela ${f.instalment}/${f.installments} de venda` })
      : tr({ en: `Expense instalment ${f.instalment}/${f.installments}`, pt: `Parcela ${f.instalment}/${f.installments} de gasto` });
  }
  return f.kind === "sale"
    ? tr({ en: "Sale received today", pt: "Venda recebida hoje" })
    : tr({ en: "Expense paid today", pt: "Gasto pago hoje" });
}

/** The small line under it: what for (an expense), how, and the day it was made. */
function detail(f: FallingDue): string {
  return [
    f.kind === "expense" ? categoryLabel(f.category) : "",
    f.payment_method ? methodLabel(f.payment_method) : "",
    tr({ en: `from ${dm(f.from_day)}`, pt: `de ${dm(f.from_day)}` }),
  ].filter(Boolean).join(" · ");
}

/**
 * Where a day's figures come from when they are not its own lines (20270113,
 * 20270114): an instalment of a sale or expense made on another day, falling
 * due on this one, counts here; what this day's own lines leave for later does
 * not. Without this, "Vendas R$ 200" could show on a day she recorded no sale.
 */
export function DayNotes({ day }: { day: HistoryDay | undefined }) {
  const due = day?.falling_due ?? [];
  const later = day?.later_cents ?? { sales: 0, expenses: 0 };
  if (due.length === 0 && later.sales === 0 && later.expenses === 0) return null;
  return (
    <div className="space-y-1.5 text-sm">
      {due.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card"
          aria-label={tr({ en: "From other days, counted today", pt: "De outros dias, contado hoje" })}>
          {due.map((f, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0">
                <span className="block">{f.kind === "sale" ? "💰" : "💸"} {title(f)}</span>
                <span className="block text-xs text-muted-foreground">{detail(f)}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${f.kind === "sale" ? "text-sales" : "text-expense"}`}>{brl(f.amount_cents)}</span>
            </li>
          ))}
        </ul>
      )}
      {(later.sales > 0 || later.expenses > 0) && (
        <p className="text-xs text-muted-foreground">
          {[
            later.expenses > 0 && tr({ en: `${brl(later.expenses)} in expenses`, pt: `${brl(later.expenses)} em gastos` }),
            later.sales > 0 && tr({ en: `${brl(later.sales)} in sales`, pt: `${brl(later.sales)} em vendas` }),
          ].filter(Boolean).join(tr({ en: " and ", pt: " e " }))}
          {tr({ en: " fall due later and do not count today.", pt: " vencem depois e não contam hoje." })}
        </p>
      )}
    </div>
  );
}
