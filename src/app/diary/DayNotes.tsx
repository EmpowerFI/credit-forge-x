import { tr } from "../i18n";
import { brl, type HistoryDay } from "./diary";

const dm = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

/**
 * Where a day's figures come from when they are not its own lines (20270113):
 * an instalment of a sale or expense from another day, falling due on this
 * one, counts here; what this day's lines leave for later does not. Without
 * this, "vendeu R$ 200" could show on a day she recorded no sale.
 */
export function DayNotes({ day }: { day: HistoryDay | undefined }) {
  const due = day?.falling_due ?? [];
  const later = day?.later_cents ?? { sales: 0, expenses: 0 };
  if (due.length === 0 && later.sales === 0 && later.expenses === 0) return null;
  return (
    <ul className="space-y-0.5 text-sm text-muted-foreground" aria-label={tr({ en: "Where these figures come from", pt: "De onde vêm estes valores" })}>
      {due.map((f, i) => {
        const what = f.kind === "sale" ? tr({ en: "sale", pt: "venda" }) : tr({ en: "expense", pt: "gasto" });
        const part = f.installments > 1
          ? tr({ en: `Instalment ${f.instalment}/${f.installments} of the ${what} of ${dm(f.from_day)}`, pt: `Parcela ${f.instalment}/${f.installments} da ${f.kind === "sale" ? "venda" : "compra"} de ${dm(f.from_day)}` })
          : f.kind === "sale"
            ? tr({ en: `Received today, from the sale of ${dm(f.from_day)}`, pt: `Recebido hoje, da venda de ${dm(f.from_day)}` })
            : tr({ en: `Paid today, from the expense of ${dm(f.from_day)}`, pt: `Pago hoje, do gasto de ${dm(f.from_day)}` });
        return (
          <li key={i}>
            <span className={f.kind === "sale" ? "text-sales" : "text-expense"}>↳</span> {part}: {brl(f.amount_cents)}
          </li>
        );
      })}
      {later.expenses > 0 && (
        <li>{tr({ en: `Expenses for later, not counted today: ${brl(later.expenses)}`, pt: `Gastos para pagar depois, não contam hoje: ${brl(later.expenses)}` })}</li>
      )}
      {later.sales > 0 && (
        <li>{tr({ en: `Sales to receive later, not counted today: ${brl(later.sales)}`, pt: `Vendas para receber depois, não contam hoje: ${brl(later.sales)}` })}</li>
      )}
    </ul>
  );
}
