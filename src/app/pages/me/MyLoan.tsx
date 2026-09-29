import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import StatusPill from "../../components/product/StatusPill";
import { tr } from "../../i18n";
import { describeError } from "../../lib/errors";
import { fetchMyLoan, myLoanKey, type MyLoan as Loan, type Paid, payInstalment, units, usdc } from "../../lib/myLoan";
import { money } from "../../lib/readiness";

// Her loan, and the one movement she is the author of.
//
// Until now an instalment was something recorded about her by the desk, so the
// half of the loop this company exists to show — money going back — happened on
// a screen she could not open. This is that half, from her side: she pays in
// the currency she trades in, and the page shows where it goes next rather than
// stopping at a receipt.
//
// No explanation drawer. Everything here is either a figure she recognises or a
// button she can press; what the parity is and how the rate was struck belong
// to the people who argue about them, not to the person paying.

/** What one instalment does on the way out, once it has been paid. */
function Journey({ paid, loanCurrency }: { paid: Paid; loanCurrency: string | null }) {
  const steps = [
    paid.local_units !== null && paid.local_economy && loanCurrency
      ? { key: "local", figure: units(paid.local_units, loanCurrency),
          what: tr({ en: `back to the ${paid.local_economy} treasury`, pt: `de volta à tesouraria da ${paid.local_economy}` }) }
      : null,
    { key: "brl", figure: money(paid.amount_cents),
      what: paid.local_units !== null
        ? tr({ en: "released, exactly what was held behind those units", pt: "liberados, exatamente o que estava guardado atrás daquelas unidades" })
        : tr({ en: "received by the desk", pt: "recebidos pela mesa" }) },
    paid.micro_usdc !== null
      ? { key: "usdc", figure: usdc(paid.micro_usdc),
          what: tr({ en: "on its way to whoever funded you", pt: "a caminho de quem financiou você" }) }
      : null,
  ].filter((s): s is { key: string; figure: string; what: string } => s !== null);

  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-positive">
        <Check size={16} strokeWidth={3} aria-hidden />
        {tr({ en: `Instalment ${paid.instalment_no} of ${paid.of_term} paid`, pt: `Parcela ${paid.instalment_no} de ${paid.of_term} paga` })}
      </p>
      <ol className="mt-4 space-y-1">
        {steps.map((s, i) => (
          <li key={s.key}>
            {i > 0 && <ArrowDown size={14} className="my-1 ml-6 text-accent" aria-hidden />}
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="num w-40 shrink-0 font-heading text-xl font-bold text-foreground">{s.figure}</span>
              <span className="min-w-0 text-sm text-muted-foreground">{s.what}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The next instalment, and the button that pays it. */
function Next({ loan, paid, onPaid }: { loan: Loan; paid: Paid | null; onPaid: (p: Paid) => void }) {
  const client = useQueryClient();
  const pay = useMutation({
    mutationFn: () => payInstalment(loan.loan_id),
    onSuccess: (p) => { onPaid(p); void client.invalidateQueries({ queryKey: myLoanKey }); },
  });

  if (loan.next_no === null) {
    return (
      <div className="panel p-6">
        <StatusPill tone="positive">{tr({ en: "Fully repaid", pt: "Totalmente paga" })}</StatusPill>
        <p className="mt-3 text-sm text-muted-foreground">
          {tr({ en: "Every instalment on this loan is paid.", pt: "Todas as parcelas deste empréstimo estão pagas." })}
        </p>
      </div>
    );
  }

  // What she is about to hand over, in the currency she actually holds. A loan
  // that never landed on a rail is repaid in reais and says so.
  const amount = loan.local ? units(loan.local.instalment_units, loan.local.currency) : money(loan.instalment_cents);
  const short = loan.local !== null && loan.local.balance_units < loan.local.instalment_units;

  return (
    <div className="panel p-6">
      <p className="text-sm text-muted-foreground">
        {tr({ en: `Instalment ${loan.next_no} of ${loan.term_months}`, pt: `Parcela ${loan.next_no} de ${loan.term_months}` })}
      </p>
      <p className="num mt-1 font-heading text-4xl font-bold text-foreground">{amount}</p>
      {loan.local && (
        <p className="num mt-1 text-sm text-muted-foreground">
          {tr({ en: `You hold ${units(loan.local.balance_units, loan.local.currency)}`, pt: `Você tem ${units(loan.local.balance_units, loan.local.currency)}` })}
        </p>
      )}

      <Button
        size="lg"
        className="mt-5 h-12 w-full gap-2 bg-accent text-base font-bold text-accent-foreground hover:bg-accent/90 sm:w-auto sm:px-8"
        disabled={pay.isPending || short}
        onClick={() => pay.mutate()}
      >
        {pay.isPending && <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden />}
        {tr({ en: "Pay this instalment", pt: "Pagar esta parcela" })}
      </Button>

      {short && (
        <p className="mt-3 text-sm text-caution">
          {tr({
            en: "You do not hold enough local units for this instalment yet — they come back as your customers pay you.",
            pt: "Você ainda não tem unidades locais suficientes para esta parcela — elas voltam conforme seus clientes pagam você.",
          })}
        </p>
      )}
      {pay.isError && <p className="mt-3 text-sm text-alert">{describeError(pay.error)}</p>}
      {paid && <Journey paid={paid} loanCurrency={loan.local?.currency ?? null} />}
    </div>
  );
}

export default function MyLoanPage() {
  const loan = useQuery({ queryKey: myLoanKey, queryFn: fetchMyLoan });
  const [paid, setPaid] = useState<Paid | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tr({ en: "My business", pt: "Meu negócio" })}
        title={tr({ en: "My loan", pt: "Meu empréstimo" })}
        description={tr({
          en: "What you borrowed, what you have paid, and what is left.",
          pt: "O que você pegou, o que já pagou, e o que falta.",
        })}
      />

      {loan.isError ? (
        <LoadError error={loan.error} onRetry={() => void loan.refetch()} />
      ) : loan.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : !loan.data ? (
        <div className="panel p-6">
          <p className="font-heading text-lg font-bold text-foreground">
            {tr({ en: "You have no loan yet", pt: "Você ainda não tem empréstimo" })}
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {tr({
              en: "When your business is ready you can ask for capital, and this page will follow the loan and every instalment.",
              pt: "Quando seu negócio estiver pronto você pode pedir capital, e esta página vai acompanhar o empréstimo e cada parcela.",
            })}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/app/me#capital">{tr({ en: "Go to my business", pt: "Ir para meu negócio" })}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Next loan={loan.data} paid={paid} onPaid={setPaid} />

          <div className="panel h-fit space-y-4 p-6">
            <dl className="space-y-3">
              {[
                { k: tr({ en: "Borrowed", pt: "Emprestado" }), v: money(loan.data.principal_cents) },
                { k: tr({ en: "Paid so far", pt: "Pago até agora" }), v: `${loan.data.paid} / ${loan.data.term_months}` },
                { k: tr({ en: "Left to pay", pt: "Falta pagar" }), v: money(loan.data.left_cents) },
              ].map((r) => (
                <div key={r.k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">{r.k}</dt>
                  <dd className="num font-heading text-lg font-bold text-foreground">{r.v}</dd>
                </div>
              ))}
            </dl>

            {loan.data.payments.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">{tr({ en: "Paid", pt: "Pagas" })}</p>
                <ul className="mt-2 space-y-1.5">
                  {loan.data.payments.map((p) => (
                    <li key={p.no} className="num flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {tr({ en: `Instalment ${p.no}`, pt: `Parcela ${p.no}` })}
                        {/* Not every instalment took the same road, and the two
                            paid before this territory had a rail did not take
                            it at all. */}
                        {p.on_the_rail && loan.data?.local && (
                          <span className="ml-1.5 text-xs text-accent">{loan.data.local.currency}</span>
                        )}
                      </span>
                      <span className="text-foreground">{money(p.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Where it goes next, for whoever wants to know. A link, not a
                third of this page: what she came here to do is pay. */}
            <div className="border-t border-border pt-4">
              <Link to="/app/me/route" className="text-sm text-info hover:underline">
                {tr({ en: "The route of your money →", pt: "A rota do seu dinheiro →" })}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
