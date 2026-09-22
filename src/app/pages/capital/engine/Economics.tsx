import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Gauge, ShieldCheck } from "lucide-react";
import StatTile from "../../../components/product/StatTile";
import { useAuth } from "../../../auth/useAuth";
import { formatNumber, tr } from "../../../i18n";
import { AFFORDABILITY_LIMIT_BPS, type EngineOpportunity } from "../../../lib/engine";
import { CARD_SOURCE, fetchOpportunityEconomics, staffHours } from "../../../lib/economics";
import { money } from "../../../lib/readiness";
import { DECISION_LABEL } from "../../../lib/economics";

// What producing this opportunity cost — two numbers, never one.
//
// What was recorded for her, against her own ticket, always comes out below the
// programme's cost per R$ 100 lent: hers counts the one path that worked, and
// the programme's counts the funnel that produced it, everyone prepared
// included. Showing only the first would flatter the number and quietly
// contradict /app/capital/economics. So both are here, and the gap between
// them is named.
//
// Costs are not for everyone: an investor sees an opportunity, never what it
// cost to make one. The reader refuses them, and this section does not render.

const CAN_SEE = ["partner", "admin", "auditor", "sponsor"];

export default function Economics({ o }: { o: EngineOpportunity }) {
  const { profile } = useAuth();
  const allowed = Boolean(profile && CAN_SEE.includes(profile.role));
  const q = useQuery({
    queryKey: ["platform", "opportunity-economics", o.opportunity_id],
    queryFn: () => fetchOpportunityEconomics(o.opportunity_id),
    enabled: allowed,
    retry: false,
  });
  // A sponsor may open an opportunity outside its programmes; the database
  // refuses, and the page simply does not show this part.
  if (!allowed || q.isError || !q.data) return null;
  const d = q.data;
  const hers = d.so_far.per_100_of_ticket_cents;
  const programme = d.programme.per_100_disbursed_cents;
  const affordability = o.eligibility.affordability_bps;

  return (
    <section className="rounded-xl border border-border" aria-labelledby="run-economics">
      <div className="grid lg:grid-cols-2">
        <div className="space-y-4 p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <Gauge size={13} aria-hidden /> {tr({ en: "What it cost to produce", pt: "O que custou produzir" })}
          </p>
          <h3 id="run-economics" className="font-heading text-base font-bold text-foreground">
            {tr({ en: "Two numbers, never one", pt: "Dois números, nunca um" })}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={tr({ en: "This opportunity, so far", pt: "Esta oportunidade, até agora" })}
              value={money(d.so_far.total_cents)}
              hint={tr({
                en: `recorded for her: ${formatNumber(d.so_far.events)} events, ${staffHours(d.so_far.staff_minutes)}`,
                pt: `registrado para ela: ${formatNumber(d.so_far.events)} eventos, ${staffHours(d.so_far.staff_minutes)}`,
              })} />
            <StatTile label={tr({ en: "Per R$ 100 of her ticket", pt: "Por R$ 100 do ticket dela" })} value={money(hers)}
              hint={tr({ en: "her own costs only", pt: "só os custos dela" })} />
            {/* The funnel-wide number gets the full width: it is the one a
                lender has to cover, and its label must not be cut. */}
            <div className="col-span-2">
              <StatTile label={tr({ en: "The programme, per R$ 100 lent", pt: "O programa, por R$ 100 emprestados" })}
                value={money(programme)}
                hint={tr({
                  en: `${formatNumber(d.programme.participants)} participants, ${formatNumber(d.programme.loans)} loans · credit alone ${money(d.programme.credit_per_100_disbursed_cents)}`,
                  pt: `${formatNumber(d.programme.participants)} participantes, ${formatNumber(d.programme.loans)} empréstimos · só o crédito ${money(d.programme.credit_per_100_disbursed_cents)}`,
                })} hintTone="caution" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{tr({
            en: <><span className="num text-foreground">{money(hers)}</span> is not what it costs to lend to her. It counts the one path that worked. The programme's <span className="num text-foreground">{money(programme)}</span> counts the funnel that produced it, everyone prepared who never borrowed included — and that is the number a lender has to cover.</>,
            pt: <><span className="num text-foreground">{money(hers)}</span> não é o que custa emprestar para ela. Conta o único caminho que deu certo. Os <span className="num text-foreground">{money(programme)}</span> do programa contam o funil que o produziu, com todas as preparadas que nunca pediram crédito — e é esse o número que um financiador precisa cobrir.</>,
          })}</p>
          {d.at_allocation && (
            <p className="text-xs text-muted-foreground">{tr({
              en: `Frozen when it opened for funding: ${money(d.at_allocation.cost_total_cents)} by then, priced by rate card ${d.at_allocation.rate_card_version}. Later events do not change it, and neither does a new card.`,
              pt: `Congelado quando abriu para captação: ${money(d.at_allocation.cost_total_cents)} até ali, precificado pela tabela ${d.at_allocation.rate_card_version}. Os eventos posteriores não mudam isso, e uma tabela nova também não.`,
            })}</p>
          )}
          <p className="text-xs text-muted-foreground">
            <Link to="/app/capital/economics" className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-foreground">
              {tr({ en: "Operating economics", pt: "Economia operacional" })} <ArrowRight size={13} aria-hidden />
            </Link>{" "}
            {tr({
              en: `— the programme's number in full, priced by ${d.programme.rate_card.version} (${CARD_SOURCE[d.programme.rate_card.source]}).`,
              pt: `— o número do programa por inteiro, precificado por ${d.programme.rate_card.version} (${CARD_SOURCE[d.programme.rate_card.source]}).`,
            })}
          </p>
        </div>

        <div className="space-y-4 border-t border-border bg-secondary/25 p-5 lg:border-l lg:border-t-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-positive">
            <ShieldCheck size={13} aria-hidden /> {tr({ en: "Must not be sacrificed", pt: "Não pode ser sacrificado" })}
          </p>
          <h3 className="font-heading text-base font-bold text-foreground">
            {tr({ en: "What was not skipped to get here", pt: "O que não foi pulado para chegar aqui" })}
          </h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">{tr({ en: "Instalment against what the business makes", pt: "Parcela contra o que o negócio ganha" })}</dt>
              <dd className="num shrink-0 font-semibold text-foreground">
                {affordability == null ? "—" : `${formatNumber(affordability / 100, { maximumFractionDigits: 1 })}%`}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {tr({ en: `limit ${AFFORDABILITY_LIMIT_BPS / 100}%`, pt: `limite ${AFFORDABILITY_LIMIT_BPS / 100}%` })}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">{tr({ en: "Eligibility", pt: "Elegibilidade" })}</dt>
              <dd className="shrink-0 font-semibold text-foreground">{DECISION_LABEL[o.eligibility.decision] ?? o.eligibility.decision}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{tr({ en: "Rules that decided", pt: "Regras que decidiram" })}</dt>
              <dd className="shrink-0 text-right text-xs text-muted-foreground">
                {o.readiness.model_version}<br />{o.eligibility.model_version}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{tr({
            en: "Cheaper to operate has to mean the same checks, run faster and by rules anyone can read — not fewer checks. Each of these ran on her, and each is proven on Solana.",
            pt: "Mais barato de operar precisa significar as mesmas checagens, mais rápidas e por regras que qualquer um pode ler — não menos checagens. Todas rodaram para ela, e cada uma está provada na Solana.",
          })}</p>
        </div>
      </div>
    </section>
  );
}
