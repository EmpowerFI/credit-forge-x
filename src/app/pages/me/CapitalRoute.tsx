import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import { formatNumber, tr } from "../../i18n";
import { RailMarker } from "../../components/product/MoneyRail";
import { railCard, type RailState, useRailReveal } from "../../lib/moneyRail";
import { fetchMyLoan, myLoanKey, type MyLoan as Loan, units, usdc } from "../../lib/myLoan";
import { money } from "../../lib/readiness";

// The loop, from her side.
//
// The engine page explains the same movement to the people who put the money
// up, and she cannot open it: it holds other people's requests and the pools'
// liquidity. This is the part that is hers — where what she borrowed came from,
// and where each instalment goes — with her own figures in it.
//
// Every number here is read from my_loan(). Nothing is derived: the dollars her
// instalment is worth are the ones the platform struck a rate for, not a
// division done in this file. Where a leg has no figure, it is described and
// left without one rather than given a plausible number.

interface LegSpec { figure?: string; what: string }

/** One leg of the route: a figure, or none, and what happened. */
function Leg({ leg, state, first, last }: { leg: LegSpec; state: RailState; first?: boolean; last?: boolean }) {
  return (
    <li className="flex gap-3">
      <RailMarker state={state} first={first} last={last} />
      <div className={`${railCard(state)} flex flex-wrap items-baseline gap-x-3 pb-4`}>
        <span className="num w-40 shrink-0 font-heading text-xl font-bold text-foreground">{leg.figure ?? ""}</span>
        <span className="min-w-0 text-sm text-muted-foreground">{leg.what}</span>
      </div>
    </li>
  );
}

/** The legs of one direction, settling in the order the money moves. */
function Rail({ legs }: { legs: LegSpec[] }) {
  const rail = useRailReveal(legs.length);
  return (
    <ol ref={rail.ref}>
      {legs.map((leg, i) => (
        <Leg key={leg.what} leg={leg} state={rail.state(i)} first={i === 0} last={i === legs.length - 1} />
      ))}
    </ol>
  );
}

const rate = (milli: number) =>
  `R$ ${formatNumber(milli / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/USDC`;

function Arrived({ loan }: { loan: Loan }) {
  const fx = loan.fx_brl_per_usdc_milli;
  return (
    <Panel title={tr({ en: "How it reached you", pt: "Como chegou até você" })}
      description={tr({
        en: "Your loan was funded from outside Brazil, and had to become the currency you trade in before it could be yours.",
        pt: "Seu empréstimo foi financiado de fora do Brasil, e precisou virar a moeda em que você negocia antes de ser seu.",
      })}>
      <Rail legs={[
        { what: tr({
          en: "People outside Brazil put up dollars for your request, in USDC.",
          pt: "Pessoas fora do Brasil aportaram dólares para o seu pedido, em USDC.",
        }) },
        { figure: fx !== null ? rate(fx) : undefined, what: fx !== null
          ? tr({
            en: "the rate this request was booked at, when the dollars became reais",
            pt: "a cotação em que este pedido foi registrado, quando os dólares viraram reais",
          })
          : tr({
            en: "The reais came from capital already in Brazil, so nothing had to be converted.",
            pt: "Os reais vieram de capital que já estava no Brasil, então nada precisou ser convertido.",
          }) },
        { figure: money(loan.principal_cents), what: loan.local
          ? tr({
            en: `into the credit fund of ${loan.local.economy}, and to you as ${loan.local.currency} you spend with merchants in your territory`,
            pt: `para o fundo de crédito da ${loan.local.economy}, e para você como ${loan.local.currency} que você gasta com comerciantes do seu território`,
          })
          : tr({ en: "paid to your business", pt: "pagos ao seu negócio" }) },
      ]} />
    </Panel>
  );
}

function Back({ loan }: { loan: Loan }) {
  const l = loan.local;
  return (
    <Panel title={tr({ en: "Where each instalment goes", pt: "Para onde vai cada parcela" })}
      description={tr({
        en: "You pay in the currency you trade in. The same three steps, in the other direction.",
        pt: "Você paga na moeda em que negocia. Os mesmos três passos, no outro sentido.",
      })}>
      <Rail legs={[
        ...(l ? [{ figure: units(l.instalment_units, l.currency), what: tr({
          en: `back to the ${l.economy} treasury`,
          pt: `de volta à tesouraria da ${l.economy}`,
        }) }] : []),
        { figure: money(loan.instalment_cents), what: l
          ? tr({
            en: "released, exactly what was held behind those units",
            pt: "liberados, exatamente o que estava guardado atrás daquelas unidades",
          })
          : tr({ en: "received by the desk", pt: "recebidos pela mesa" }) },
        ...(loan.instalment_micro_usdc !== null
          ? [{ figure: usdc(loan.instalment_micro_usdc),
               what: tr({ en: "on its way to whoever funded you", pt: "a caminho de quem financiou você" }) }]
          : []),
      ]} />
      <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
        {tr({
          en: `${loan.paid} of ${loan.term_months} paid so far. The rate is struck again at each movement, so what your instalment is worth in dollars is decided when it is sent, not today.`,
          pt: `${loan.paid} de ${loan.term_months} pagas até agora. A cotação é fechada de novo em cada movimento, então quanto sua parcela vale em dólares é decidido quando ela é enviada, não hoje.`,
        })}
      </p>
    </Panel>
  );
}

export default function CapitalRoute() {
  const { data: loan, isLoading, error, refetch } = useQuery({ queryKey: myLoanKey, queryFn: fetchMyLoan });

  return (
    <div className="space-y-6">
      <Link to="/app/me/loan" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> {tr({ en: "My loan", pt: "Meu empréstimo" })}
      </Link>
      <PageHeader
        eyebrow={tr({ en: "My business", pt: "Meu negócio" })}
        title={tr({ en: "The route of your money", pt: "A rota do seu dinheiro" })}
        description={tr({
          en: "Where what you borrowed came from, and where each instalment goes.",
          pt: "De onde veio o que você pegou, e para onde vai cada parcela.",
        })} />

      {error ? <LoadError error={error} onRetry={() => void refetch()} />
        : isLoading ? <Skeleton className="h-64 w-full rounded-2xl" />
        : !loan ? (
          <Panel title={tr({ en: "No loan yet", pt: "Ainda sem empréstimo" })}>
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "This page fills in once a loan of yours has been disbursed.",
                pt: "Esta página se preenche quando um empréstimo seu for desembolsado.",
              })}
            </p>
          </Panel>
        ) : (
          <div className="space-y-4">
            <Arrived loan={loan} />
            <Back loan={loan} />
          </div>
        )}
    </div>
  );
}
