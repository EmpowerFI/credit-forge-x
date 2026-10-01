import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FlaskConical, Gauge, Plane, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import LoadError from "../../components/LoadError";
import PageEvidence from "../../components/product/PageEvidence";
import PageHeader from "../../components/product/PageHeader";
import StatTile from "../../components/product/StatTile";
import { useAuth } from "../../auth/useAuth";
import { formatNumber, tr } from "../../i18n";
import { REASON } from "../../lib/capital";
import { ELIGIBILITY_REASON } from "../../lib/credit";
import {
  BEARER_LABEL, BEARER_SELLS, bps, type CapitalMobilization, capitalMobilizationKey, CARD_SOURCE,
  type CostSensitivity, DECISION_LABEL, duration, fetchCapitalMobilization, fetchCostSensitivity,
  fetchOperatingEconomics, type OperatingEconomics as Data, PHASE_LABEL, PROVENANCE, type Provenance,
  share, STAGE_LABEL, staffHours, STEP_LABEL,
} from "../../lib/economics";
import { fetchPrograms } from "../../lib/impact";
import { money } from "../../lib/readiness";
import BusinessModel from "./BusinessModel";

// What it costs to operate productive credit, and what may not be sacrificed to
// make it cheaper (refactor spec §2A). Four pairs: the number that falls beside
// the discipline it may not cost, each with where the platform measures it.
//
// Posing that as a question was the wrong shape. The model is built and it runs,
// and both halves of every pair are instrumented — which is the claim. What a
// pilot adds is field rates in place of the card's assumed ones, so the honest
// labels here are about the *inputs*: the rate card is an assumption and the
// demo's records are simulated. Those stay. Doubting the work does not.

const ALL = "all";

/** One pair: a number that must improve, beside the discipline it must not cost. */
function Pair({ id, improve, keep, measured }: {
  id: string;
  improve: { title: string; body: ReactNode };
  keep: { id?: string; title: string; body: ReactNode };
  measured: string;
}) {
  return (
    <section id={id} className="panel scroll-mt-32 overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <div className="space-y-4 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-accent"><Gauge size={13} aria-hidden /> {tr({ en: "Must improve", pt: "Precisa melhorar" })}</p>
          <h2 className="font-heading text-lg font-bold text-foreground">{improve.title}</h2>
          {improve.body}
        </div>
        <div id={keep.id} className="scroll-mt-32 space-y-4 border-t border-border bg-secondary/25 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-positive"><ShieldCheck size={13} aria-hidden /> {tr({ en: "Must not be sacrificed", pt: "Não pode ser sacrificado" })}</p>
          <h2 className="font-heading text-lg font-bold text-foreground">{keep.title}</h2>
          {keep.body}
        </div>
      </div>
      <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground sm:px-6">
        <span className="font-medium text-foreground">{tr({ en: "How it is measured: ", pt: "Como é medido: " })}</span>{measured}
      </p>
    </section>
  );
}

/** Counts as bars against the largest, labelled. */
function Bars({ rows, tone = "bg-accent" }: { rows: { key: string; label: string; n: number }[]; tone?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{tr({ en: "Nothing recorded yet.", pt: "Nada registrado ainda." })}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 text-foreground">{r.label}</span>
            <span className="num shrink-0 font-semibold text-foreground">{formatNumber(r.n)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${(r.n / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Line({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}{hint && <span className="block text-xs">{hint}</span>}</span>
      <span className="num shrink-0 text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

/**
 * What a larger ticket would do — a model over the rate card, never over the
 * recorded events, which are facts about work that happened. Nothing in the
 * work changes with the ticket; only the amount it is divided by. That is the
 * assumption behind small-ticket economics, shown so a reader can check it
 * rather than take it.
 */
function TicketModel({ s, measured }: { s: CostSensitivity; measured: number | null }) {
  const rows = s.tickets;
  const top = Math.max(1, ...rows.map((r) => r.per_100_disbursed_cents ?? r.credit_per_100_cents));
  const conversion = s.basis.participants_per_loan;
  const observed = s.basis.occurrences === "observed" && conversion != null;
  const perLoan = formatNumber(conversion ?? 0, { maximumFractionDigits: 1 });
  const modelled = rows.find((r) => r.is_current)?.per_100_disbursed_cents;
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{tr({ en: "If the ticket were larger", pt: "Se o ticket fosse maior" })}</h3>
        <span className="rounded-full border border-caution/35 px-2 py-0.5 text-[11px] font-medium text-caution">
          {tr({ en: "Illustrative model", pt: "Modelo ilustrativo" })}
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const all = r.per_100_disbursed_cents;
          return (
            <li key={r.ticket_cents} className={cn("space-y-1", r.is_current && "rounded-md bg-secondary/40 px-2 py-1.5")}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="num min-w-0 text-foreground">
                  {money(r.ticket_cents)}
                  {r.is_current && <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-accent">{tr({ en: "lent here", pt: "emprestado aqui" })}</span>}
                </span>
                <span className="num shrink-0 text-right">
                  <span className="font-semibold text-foreground">{money(all)}</span>
                  <span className="block text-[11px] text-muted-foreground">{tr({ en: "credit ", pt: "crédito " })}{money(r.credit_per_100_cents)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: `${((all ?? r.credit_per_100_cents) / top) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{tr({
        en: <>Per R$ 100 lent, all-in; credit alone beneath it. A model over the rate card, not a measurement.{" "}
          {observed
            ? <>Each stage costs what the card says and happens as often as it happens here — {perLoan} participants reached for every loan made.</>
            : <>Each stage costs what the card says; with nothing lent in this scope yet, the model assumes one of each origination step and twelve instalments.</>}{" "}
          Nothing in the work changes with the ticket; only the amount it is divided by — and that conversion moves the all-in number more than the ticket does.</>,
        pt: <>Por R$ 100 emprestados, tudo incluído; o crédito sozinho abaixo. Um modelo sobre a tabela de custos, não uma medição.{" "}
          {observed
            ? <>Cada etapa custa o que a tabela diz e acontece na frequência em que acontece aqui — {perLoan} participantes alcançadas para cada empréstimo feito.</>
            : <>Cada etapa custa o que a tabela diz; como ainda não há nada emprestado neste escopo, o modelo assume uma ocorrência de cada etapa de originação e doze parcelas.</>}{" "}
          Nada no trabalho muda com o ticket; muda só o valor pelo qual ele é dividido — e essa conversão move o número com tudo incluído mais do que o ticket.</>,
      })}</p>
      {/* The model, held against the measurement at the same ticket. Without
          this line the two numbers would sit on one page and disagree in
          silence. */}
      {measured != null && (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">{tr({
          en: <>At the ticket lent here the model gives <span className="num text-foreground">{money(modelled)}</span> against the <span className="num text-foreground">{money(measured)}</span> recorded above. The model prices the minutes the card assumes; the measurement counts the minutes the work actually took, the extra time included. The distance between them is what the pilot has to close.</>,
          pt: <>No ticket emprestado aqui o modelo dá <span className="num text-foreground">{money(modelled)}</span> contra os <span className="num text-foreground">{money(measured)}</span> registrados acima. O modelo precifica os minutos que a tabela assume; a medição conta os minutos que o trabalho de fato levou, com o tempo extra. A distância entre os dois é o que o piloto precisa fechar.</>,
        })}</p>
      )}
    </div>
  );
}

function CostPair({ d, s }: { d: Data; s?: CostSensitivity }) {
  const c = d.cost;
  const phases = (["preparation", "origination", "servicing"] as const);
  const total = Math.max(1, c.total_cents);
  const decisions = (["ELIGIBLE", "ELIGIBLE_REDUCED", "MANUAL_REVIEW", "NOT_ELIGIBLE"] as const)
    .map((k) => ({ key: k, label: DECISION_LABEL[k], n: d.discipline.decisions[k] ?? 0 }));
  return (
    <Pair id="cost"
      improve={{
        title: tr({ en: "Cost to serve", pt: "Custo de servir" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Credit, per R$ 100 lent", pt: "Crédito, por R$ 100 emprestados" })} value={money(c.credit_per_100_disbursed_cents)}
                hint={tr({ en: "origination + servicing", pt: "originação + acompanhamento" })} />
              {/* The same denominator, a different question: this one divides
                  the whole funnel — everyone reached, borrower or not — by the
                  reais lent, so it answers what the programme costs, not what
                  the credit costs. */}
              <StatTile label={tr({ en: "Programme + credit, per R$ 100 lent", pt: "Programa + crédito, por R$ 100 emprestados" })}
                value={money(c.per_100_disbursed_cents)}
                hint={tr({ en: "everyone reached, borrower or not", pt: "todas as alcançadas, peçam crédito ou não" })} />
              <StatTile label={tr({ en: "Per qualified opportunity", pt: "Por oportunidade qualificada" })} value={money(c.per_opportunity_cents)} />
              <StatTile label={tr({ en: "Per participant", pt: "Por participante" })} value={money(c.per_participant_cents)}
                hint={tr({ en: `${formatNumber(d.scope.participants)} reached`, pt: `${formatNumber(d.scope.participants)} alcançadas` })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary" role="img"
                aria-label={phases.map((p) => `${PHASE_LABEL[p]} ${money(c.by_phase[p])}`).join(", ")}>
                <div className="bg-muted-foreground/40" style={{ width: `${(c.by_phase.preparation / total) * 100}%` }} />
                <div className="bg-accent" style={{ width: `${(c.by_phase.origination / total) * 100}%` }} />
                <div className="bg-positive" style={{ width: `${(c.by_phase.servicing / total) * 100}%` }} />
              </div>
              <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                {phases.map((p, i) => (
                  <span key={p}><span className={["text-muted-foreground/60", "text-accent", "text-positive"][i]}>■</span> {PHASE_LABEL[p]} {money(c.by_phase[p])}</span>
                ))}
              </p>
              <p className="text-xs text-muted-foreground">{tr({
                en: "Preparation reaches every participant, whether or not she borrows, and the community does it on a budget of its own. What a loan adds is its origination and servicing.",
                pt: "O preparo alcança todas as participantes, peçam crédito ou não, e quem o faz é a comunidade, com orçamento próprio. O que um empréstimo acrescenta é a originação e o acompanhamento.",
              })}</p>
              {/* The same total, split by who pays it rather than by where it
                  lands. A sponsor asking what EmpowerFI costs is asking this. */}
              <ul className="space-y-1.5">
                {(["empowerfi", "community", "partner"] as const).map((who) => {
                  const row = c.by_bearer[who];
                  if (!row) return null;
                  return (
                    <li key={who} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-foreground">{BEARER_LABEL[who]} <span className="text-muted-foreground">· {BEARER_SELLS[who]}</span></span>
                        <span className="num shrink-0 font-semibold text-foreground">{money(row.cents)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className={cn("h-full rounded-full", who === "empowerfi" ? "bg-accent" : who === "community" ? "bg-primary" : "bg-positive")}
                          style={{ width: `${(row.cents / total) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            {s && <TicketModel s={s} measured={c.per_100_disbursed_cents} />}
            <details className="rounded-lg border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">{tr({ en: "Cost by stage", pt: "Custo por etapa" })}</summary>
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-medium">{tr({ en: "Stage", pt: "Etapa" })}</th>
                      <th className="py-2 pr-3 font-medium">{tr({ en: "Borne by", pt: "Quem arca" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Events", pt: "Eventos" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Staff time", pt: "Tempo de equipe" })}</th>
                      <th className="py-2 text-right font-medium">{tr({ en: "Cost", pt: "Custo" })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {/* A stage is borne by more than one party — a check-in costs
                        the community her time and EmpowerFI the record — so it
                        appears once per bearer, and the stage alone is not a key. */}
                    {c.by_stage.map((s) => (
                      <tr key={`${s.stage}:${s.borne_by}`}>
                        <td className="py-1.5 pr-3 text-foreground">{STAGE_LABEL[s.stage] ?? s.stage}<span className="block text-[11px] text-muted-foreground">{PHASE_LABEL[s.phase]}</span></td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{BEARER_LABEL[s.borne_by]}</td>
                        <td className="num py-1.5 pr-3 text-right">{formatNumber(s.events)}</td>
                        <td className="num py-1.5 pr-3 text-right">{staffHours(s.staff_minutes)}</td>
                        <td className="num py-1.5 text-right font-medium">{money(s.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="text-xs text-muted-foreground">
              {tr({
                en: <>Priced by rate card <span className="text-foreground">{c.rate_card.version}</span>, {CARD_SOURCE[c.rate_card.source]}{
                  c.rate_cards_used.length > 1 ? <>. Events here were priced by more than one card ({c.rate_cards_used.join(", ")}): each keeps the one in force when it happened</> : null}.</>,
                pt: <>Precificado pela tabela <span className="text-foreground">{c.rate_card.version}</span>, {CARD_SOURCE[c.rate_card.source]}{
                  c.rate_cards_used.length > 1 ? <>. Os eventos aqui foram precificados por mais de uma tabela ({c.rate_cards_used.join(", ")}): cada um mantém a que valia quando aconteceu</> : null}.</>,
              })}
            </p>
            <p className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              {tr({
                en: <>Reference, not a comparison: a World Bank study found microfinance institutions' median operating expense near <span className="text-foreground">US$ 14 per US$ 100 of loans outstanding</span> (WPS 8252, 2005–2009). The number to hold it against is the credit one, not the programme one: it counts what an institution spends to lend, and the funnel above it is paid for by whoever funds the programme. It counts a whole institution against its portfolio; this counts modelled stage costs against reais lent. Neither is EmpowerFI's measured cost.</>,
                pt: <>Referência, não comparação: um estudo do Banco Mundial encontrou despesa operacional mediana perto de <span className="text-foreground">US$ 14 a cada US$ 100 de carteira</span> em instituições de microfinanças (WPS 8252, 2005–2009). O número a colocar ao lado é o do crédito, não o do programa: ele conta o que uma instituição gasta para emprestar, e o funil acima disso é pago por quem financia o programa. Ele conta uma instituição inteira contra sua carteira; aqui, custos modelados por etapa contra reais emprestados. Nenhum dos dois é o custo medido da EmpowerFI.</>,
              })}
            </p>
          </>
        ),
      }}
      keep={{
        id: "discipline",
        title: tr({ en: "Eligibility discipline", pt: "Disciplina de elegibilidade" }),
        body: (
          <>
            <p className="text-sm text-muted-foreground">{tr({
              en: `${formatNumber(d.discipline.runs)} eligibility runs, every one by the same published rules (${d.discipline.model_versions.join(", ") || "—"}).`,
              pt: `${formatNumber(d.discipline.runs)} rodadas de elegibilidade, todas pelas mesmas regras publicadas (${d.discipline.model_versions.join(", ") || "—"}).`,
            })}</p>
            <Bars rows={decisions} tone="bg-positive" />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Reason codes", pt: "Códigos de motivo" })}</p>
              <Bars rows={d.discipline.reasons.slice(0, 6).map((r) => ({ key: r.code, label: ELIGIBILITY_REASON[r.code] ?? r.code, n: r.n }))} tone="bg-primary" />
            </div>
          </>
        ),
      }}
      measured={tr({
        en: "cost events by stage and opportunity, priced by the pilot rate card; the engines' decisions and reason codes.",
        pt: "eventos de custo por etapa e oportunidade, precificados pela tabela do piloto; as decisões e os códigos de motivo dos motores.",
      })} />
  );
}

/** Where a figure came from: measured, given to us, assumed, or quoted elsewhere. */
function Mark({ of }: { of: Provenance }) {
  const p = PROVENANCE[of];
  return (
    <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
      p.tone === "positive" ? "border-positive/35 text-positive"
        : p.tone === "info" ? "border-info/35 text-info"
          : p.tone === "caution" ? "border-caution/35 text-caution"
            : "border-border text-muted-foreground")} title={p.says}>
      {p.label}
    </span>
  );
}

/**
 * Cost to Mobilize Capital, beside cost to serve rather than instead of it
 * (addendum v2 §7, §8). The one thing §8 insists on is that a demo never imply
 * that cheap settlement removes the operational cost of small loans, and two
 * measured numbers on one page do that where one number cannot.
 */
function MobilizationPair({ d, m }: { d: Data; m: CapitalMobilization }) {
  const efficiency = m.cost_cents > 0 ? m.mobilized_cents / m.cost_cents : null;
  const hedge = m.cost_of_capital.fx_hedge_bps_year;
  const serve = d.cost.credit_per_100_disbursed_cents;
  return (
    <Pair id="mobilization"
      improve={{
        title: tr({ en: "Cost to mobilize capital", pt: "Custo de mobilizar capital" }),
        body: (
          <>
            {/* A money tile with an icon does not fit two across at 390:
                "R$ 5.000,00" loses its last digit. One across until there is
                room, as the investor's plan tiles already do. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label={tr({ en: "Mobilised from abroad", pt: "Mobilizado do exterior" })} value={money(m.mobilized_cents)}
                hint={m.tickets === 1
                  ? tr({ en: "one ticket", pt: "um ticket" })
                  : tr({ en: `${formatNumber(m.tickets)} tickets`, pt: `${formatNumber(m.tickets)} tickets` })}
                icon={<Plane size={14} aria-hidden />} />
              <StatTile label={tr({ en: "What mobilising it cost", pt: "Quanto custou mobilizar" })} value={money(m.cost_cents)}
                hint={tr({ en: "rails and operations, hedge excluded", pt: "trilhos e operação, sem o hedge" })} />
              <StatTile label={tr({ en: "Per R$ 100 mobilised", pt: "Por R$ 100 mobilizados" })}
                value={m.rate_bps === null ? "—" : money(m.rate_bps)} hint={tr({ en: "CTM rate", pt: "taxa CTM" })} />
              <StatTile label={tr({ en: "Eligible external capital gap", pt: "Lacuna de capital externo elegível" })}
                value={money(m.eligible_gap_cents)}
                hint={m.eligible_gap_decisions === 0
                  ? tr({ en: "no plan has left one", pt: "nenhum plano deixou uma" })
                  : m.eligible_gap_decisions === 1
                    ? tr({ en: "one plan, still unfunded", pt: "um plano, ainda sem financiamento" })
                    : tr({ en: `${formatNumber(m.eligible_gap_decisions)} plans, still unfunded`, pt: `${formatNumber(m.eligible_gap_decisions)} planos, ainda sem financiamento` })}
                hintTone={m.eligible_gap_cents > 0 ? "caution" : "positive"} />
            </div>

            {/* The comparison §8 exists for. Same denominator, two different
                questions: what it costs to move the money in, and what it costs
                to make and follow the loan. They are never added. */}
            <div className="space-y-1.5 rounded-lg border border-border p-3">
              <h3 className="text-sm font-semibold text-foreground">{tr({ en: "Per R$ 100, side by side", pt: "Por R$ 100, lado a lado" })}</h3>
              <Line label={tr({ en: "To bring the money in", pt: "Para trazer o dinheiro" })}
                hint={tr({ en: "per R$ 100 mobilised", pt: "por R$ 100 mobilizados" })}
                value={<>{m.rate_bps === null ? "—" : money(m.rate_bps)} <Mark of={m.provenance} /></>} />
              <Line label={tr({ en: "To make and follow the loan", pt: "Para fazer e acompanhar o empréstimo" })}
                hint={tr({ en: "per R$ 100 lent", pt: "por R$ 100 emprestados" })}
                value={<>{serve === null ? "—" : money(serve)} <Mark of={d.cost.rate_card.source === "observed" ? "observed" : "simulated"} /></>} />
              <p className="pt-1 text-xs text-muted-foreground">{tr({
                en: "Two costs, never one, and two denominators: one divides by the capital that crossed the border, the other by the reais lent. Nothing on this page adds them — they answer different questions, they are borne at different moments, and a settlement rail that costs little does not make a small loan cheap to operate.",
                pt: "Dois custos, nunca um, e dois denominadores: um divide pelo capital que cruzou a fronteira, o outro pelos reais emprestados. Nada nesta página os soma — respondem a perguntas diferentes, são arcados em momentos diferentes, e um trilho de liquidação barato não torna barato operar um empréstimo pequeno.",
              })}</p>
            </div>

            <Line label={tr({ en: "Capital efficiency", pt: "Eficiência de capital" })}
              hint={tr({ en: "reais mobilised for each real spent mobilising", pt: "reais mobilizados para cada real gasto mobilizando" })}
              value={efficiency === null ? "—" : `${formatNumber(efficiency, { maximumFractionDigits: 0 })}×`} />
            <Line label={tr({ en: "Global funding coverage", pt: "Cobertura de capital global" })}
              hint={tr({ en: "share of everything lent here that came from outside Brazil", pt: "parte de tudo emprestado aqui que veio de fora do Brasil" })}
              value={bps(m.global_funding_coverage_bps)} />
            <Line label={tr({ en: "Time to global funding", pt: "Tempo até o capital global" })}
              hint={tr({ en: "derived from the last investment: no column records when an opportunity filled", pt: "derivado do último aporte: nenhuma coluna registra quando uma oportunidade encheu" })}
              value={m.time_to_global_funding.n === 0 ? "—" : duration(m.time_to_global_funding.median_seconds)} />
          </>
        ),
      }}
      keep={{
        id: "two-costs",
        title: tr({ en: "The two costs stay apart", pt: "Os dois custos ficam separados" }),
        body: (
          <>
            <p className="text-sm text-muted-foreground">{tr({
              en: "Cost to mobilize is what is paid to move the money: the ramp, the network, the compliance check, the wallet, the settlement. Cost to serve is what is paid to make the loan and follow it. Neither absorbs the other, and the database is built so that it cannot: their rates live in different tables, and no cost event can carry a mobilisation stage.",
              pt: "O custo de mobilizar é o que se paga para mover o dinheiro: a rampa, a rede, a verificação de compliance, a carteira, a liquidação. O custo de servir é o que se paga para fazer o empréstimo e acompanhá-lo. Nenhum absorve o outro, e o banco foi construído para que não possa: as tabelas de taxas são diferentes, e nenhum evento de custo pode carregar uma etapa de mobilização.",
            })}</p>
            <div className="space-y-1.5 rounded-lg border tone-caution p-3">
              <h3 className="text-sm font-semibold">{tr({ en: "And the hedge is not in either", pt: "E o hedge não está em nenhum dos dois" })}</h3>
              <Line label={tr({ en: "FX hedge on the global pool", pt: "Hedge cambial no pool global" })} value={bps(hedge)} />
              <p className="text-xs">{tr({
                en: "A hedge is a required return on currency risk carried over the loan's life, not a fee paid to a rail. It is priced into her rate by the pool engine and reported here beside the two costs — never summed into either, because a per-year figure added to a per-operation one gives a rate that means nothing.",
                pt: "Um hedge é um retorno exigido por risco cambial carregado ao longo da vida do empréstimo, não uma taxa paga a um trilho. Ele entra na taxa dela pelo motor de pool e é reportado aqui ao lado dos dois custos — nunca somado a nenhum, porque um número por ano somado a um por operação dá uma taxa que não significa nada.",
              })}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr({
                en: <>Priced by rate card <span className="text-foreground">{m.rate_card.version}</span>, {CARD_SOURCE[m.rate_card.source]}. Every figure above carries where it came from; nothing mixes a provider's answer with an assumption of this prototype.</>,
                pt: <>Precificado pela tabela <span className="text-foreground">{m.rate_card.version}</span>, {CARD_SOURCE[m.rate_card.source]}. Cada número acima carrega de onde veio; nada mistura a resposta de um provedor com uma premissa deste protótipo.</>,
              })}
            </p>
          </>
        ),
      }}
      measured={tr({
        en: "the mobilisation rate card, and the settlement comparator's own quote for each ticket that crossed the border — the one place in this product that prices a conversion.",
        pt: "a tabela de custos de mobilização, e a cotação do próprio comparador de liquidação para cada ticket que cruzou a fronteira — o único lugar neste produto que precifica uma conversão.",
      })} />
  );
}

function TimePair({ d }: { d: Data }) {
  const reasons = Object.fromEntries(d.discipline.reasons.map((r) => [r.code, r.n]));
  return (
    <Pair id="time"
      improve={{
        title: tr({ en: "Time to decision", pt: "Tempo até a decisão" }),
        body: (
          <ul className="divide-y divide-border/60">
            {d.timing.map((s) => (
              <li key={s.step} className={cn("flex items-baseline justify-between gap-4 py-2.5", s.step === "intent_to_disbursement" && "font-semibold")}>
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">{STEP_LABEL[s.step].label}</span>
                  <span className="block text-xs text-muted-foreground">{STEP_LABEL[s.step].who} · {tr({ en: `${s.n} cases`, pt: `${s.n} casos` })}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block font-heading text-lg font-bold text-foreground">{duration(s.median_seconds)}</span>
                  <span className="num block text-[11px] text-muted-foreground">{tr({ en: `median · 90% within ${duration(s.p90_seconds)}`, pt: `mediana · 90% em até ${duration(s.p90_seconds)}` })}</span>
                </span>
              </li>
            ))}
          </ul>
        ),
      }}
      keep={{
        title: tr({ en: "Affordability checks", pt: "Checagem de capacidade de pagamento" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Runs with the check", pt: "Rodadas com a checagem" })} value={share(d.discipline.affordability_checked, d.discipline.runs)}
                hint={`${d.discipline.affordability_checked}/${d.discipline.runs}`} hintTone="positive" />
              <StatTile label={tr({ en: "Offered less than asked", pt: "Oferta menor que o pedido" })} value={formatNumber(d.discipline.decisions.ELIGIBLE_REDUCED ?? 0)}
                hint={tr({ en: "the instalment did not fit", pt: "a parcela não cabia" })} />
            </div>
            <Line label={ELIGIBILITY_REASON.AMOUNT_ABOVE_CAPACITY} value={formatNumber(reasons.AMOUNT_ABOVE_CAPACITY ?? 0)} />
            <Line label={ELIGIBILITY_REASON.TIGHT_AFFORDABILITY} value={formatNumber(reasons.TIGHT_AFFORDABILITY ?? 0)} />
            <Line label={ELIGIBILITY_REASON.NO_REPAYMENT_CAPACITY} value={formatNumber(reasons.NO_REPAYMENT_CAPACITY ?? 0)} />
            <p className="text-xs text-muted-foreground">{tr({
              en: "Speed never skips the check: the instalment is tested against what the business makes after household expenses, on every run.",
              pt: "A velocidade nunca pula a checagem: a parcela é testada contra o que o negócio ganha depois das despesas da casa, em toda rodada.",
            })}</p>
          </>
        ),
      }}
      measured={tr({
        en: "timestamps of the request, each engine run, the opportunity, the desk's decision and the disbursement; reason codes.",
        pt: "datas e horas do pedido, de cada rodada dos motores, da oportunidade, da decisão da mesa e do desembolso; códigos de motivo.",
      })} />
  );
}

function ScalePair({ d }: { d: Data }) {
  const f = d.follow_up;
  return (
    <Pair id="scale"
      improve={{
        title: tr({ en: "Operational scalability", pt: "Escalabilidade operacional" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Steps that took no one's time", pt: "Etapas sem tempo de equipe" })} value={bps(d.cost.automated_events_share_bps)}
                hint={tr({ en: `of ${formatNumber(d.cost.events)} events`, pt: `de ${formatNumber(d.cost.events)} eventos` })} />
              <StatTile label={tr({ en: "Credit staff time per loan", pt: "Tempo de equipe no crédito, por empréstimo" })} value={staffHours(d.cost.credit_minutes_per_loan)} />
            </div>
            <Line label={tr({ en: "Check-ins sent by the entrepreneur herself", pt: "Check-ins enviados pela própria empreendedora" })} value={share(f.self_reported, f.checkins)}
              hint={tr({ en: "the rest typed in by the community, at ten minutes each", pt: "os demais digitados pela comunidade, a dez minutos cada" })} />
            <Line label={tr({ en: "Staff time, preparation", pt: "Tempo de equipe, preparo" })} value={staffHours(d.cost.minutes_by_phase.preparation)} />
            <Line label={tr({ en: "Staff time, credit", pt: "Tempo de equipe, crédito" })} value={staffHours(d.cost.minutes_by_phase.credit)} />
          </>
        ),
      }}
      keep={{
        title: tr({ en: "Continuous follow-up", pt: "Acompanhamento contínuo" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Reporting this month", pt: "Reportando neste mês" })} value={share(f.reporting, d.scope.participants)}
                hint={`${f.reporting}/${d.scope.participants}`} />
              <StatTile label={tr({ en: "Follow-ups open", pt: "Acompanhamentos em aberto" })} value={formatNumber(f.open_follow_ups)} hintTone="caution" />
            </div>
            <Line label={tr({ en: "Community contacts logged", pt: "Contatos registrados pela comunidade" })} value={formatNumber(f.contacts)} />
            <Line label={tr({ en: "Instalments recorded", pt: "Parcelas registradas" })} value={formatNumber(f.instalments_recorded)} />
            <Line label={tr({ en: "Productive outcomes measured", pt: "Resultados produtivos medidos" })} value={formatNumber(f.outcomes_measured)} />
          </>
        ),
      }}
      measured={tr({
        en: "digital check-ins, the community's logged contacts, instalments and outcome measurements, as servicing events.",
        pt: "check-ins digitais, contatos registrados pela comunidade, parcelas e medições de resultado, como eventos de acompanhamento.",
      })} />
  );
}

function CapitalPair({ d }: { d: Data }) {
  const k = d.capital;
  const q = d.quality;
  return (
    <Pair id="capital"
      improve={{
        title: tr({ en: "Capital access and coverage", pt: "Acesso a capital e cobertura" }),
        body: (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label={tr({ en: "Domestic", pt: "Doméstico" })} value={formatNumber(k.domestic)} />
              <StatTile label={tr({ en: "Global", pt: "Global" })} value={formatNumber(k.global)} />
              <StatTile label={tr({ en: "Waiting", pt: "Aguardando" })} value={formatNumber(k.waiting)} hintTone="caution" />
            </div>
            <Line label={tr({ en: "Qualified opportunities routed", pt: "Oportunidades qualificadas encaminhadas" })} value={`${k.allocated}/${k.opportunities}`} />
            <Line label={tr({ en: "Funded or lent", pt: "Captadas ou emprestadas" })} value={formatNumber(k.funded)} />
            <Bars rows={k.reasons.slice(0, 5).map((r) => ({ key: r.code, label: REASON[r.code as keyof typeof REASON]?.label ?? r.code, n: r.n }))} tone="bg-primary" />
          </>
        ),
      }}
      keep={{
        title: tr({ en: "Portfolio quality", pt: "Qualidade da carteira" }),
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={tr({ en: "Instalments on schedule", pt: "Parcelas em dia" })} value={share(q.instalments_paid, q.instalments_due)}
                hint={`${q.instalments_paid}/${q.instalments_due}`} hintTone="positive" />
              <StatTile label={tr({ en: "Loans", pt: "Empréstimos" })} value={formatNumber(q.loans)} />
            </div>
            <Line label={tr({ en: "Repaying on time", pt: "Pagando em dia" })} value={formatNumber(q.repaying)} />
            <Line label={tr({ en: "Late", pt: "Em atraso" })} value={<span className={q.late ? "text-caution" : undefined}>{formatNumber(q.late)}</span>} />
            <Line label={tr({ en: "Paid off", pt: "Quitados" })} value={formatNumber(q.paid)} />
            <Line label={tr({ en: "Defaulted", pt: "Inadimplentes" })} value={<span className={q.defaulted ? "text-alert" : undefined}>{formatNumber(q.defaulted)}</span>} />
          </>
        ),
      }}
      measured={tr({
        en: "the allocation engine's routes and reason codes; repayment, delinquency and outcome states of each loan.",
        pt: "as rotas e os códigos de motivo do motor de alocação; os estados de pagamento, atraso e resultado de cada empréstimo.",
      })} />
  );
}

export default function OperatingEconomics() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const sponsor = profile?.role === "sponsor";
  const programs = useQuery({ queryKey: ["platform", "programs"], queryFn: fetchPrograms });
  const asked = params.get("program");
  const programId = sponsor
    ? (programs.data?.find((p) => p.id === asked) ?? programs.data?.[0])?.id ?? null
    : asked && asked !== ALL ? asked : null;
  const ready = !sponsor || Boolean(programId);
  const economics = useQuery({
    queryKey: ["platform", "operating-economics", programId ?? ALL],
    queryFn: () => fetchOperatingEconomics(programId),
    enabled: ready,
  });
  // The model beside the measurement: a second reader, over the rate card.
  const sensitivity = useQuery({
    queryKey: ["platform", "cost-sensitivity", programId ?? ALL],
    queryFn: () => fetchCostSensitivity(programId),
    enabled: ready,
  });
  // What it costs to bring capital in, which §8 insists is read beside what it
  // costs to serve the loan rather than in place of it.
  const mobilization = useQuery({
    queryKey: capitalMobilizationKey(programId),
    queryFn: () => fetchCapitalMobilization(programId),
    enabled: ready,
  });
  const d = economics.data;

  if (economics.isError) return <LoadError error={economics.error} onRetry={() => economics.refetch()} />;
  if (programs.isError && sponsor) return <LoadError error={programs.error} onRetry={() => programs.refetch()} />;

  const scopes = [...(sponsor ? [] : [{ id: ALL, name: tr({ en: "Every community", pt: "Todas as comunidades" }) }]), ...(programs.data ?? [])];

  return (
    <div className="space-y-6">
      <PageHeader
        meta={<PageEvidence family="cost_rates" />}
        eyebrow={tr({ en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" })}
        title={tr({ en: "Operating economics", pt: "Economia operacional" })}
        description={tr({
          en: "What it costs to operate productive credit, and what may not be sacrificed to make it cheaper.",
          pt: "Quanto custa operar crédito produtivo, e o que não pode ser sacrificado para ficar mais barato.",
        })}
        about={tr({
          en: "EmpowerFI's operating model takes cost out of small-ticket credit without loosening it, and instruments both halves so neither has to be taken on trust. Costs come from the events each stage records, priced by the pilot's rate card; times from the timestamps of the request, the engine runs, the desk's decision and the disbursement; discipline and routing from the engines' own reason codes.",
          pt: "O modelo operacional da EmpowerFI tira custo do crédito de ticket pequeno sem afrouxá-lo, e instrumenta as duas metades para que nenhuma precise ser aceita na palavra. Os custos vêm dos eventos que cada etapa registra, precificados pela tabela do piloto; os tempos, das datas do pedido, das rodadas dos motores, da decisão da mesa e do desembolso; a disciplina e o roteamento, dos códigos de motivo dos próprios motores.",
        })}
        actions={
          <>
            {scopes.length > 1 && (
              <Select value={programId ?? ALL} onValueChange={(v) => setParams({ program: v }, { replace: true })}>
                <SelectTrigger className="w-64" aria-label={tr({ en: "Scope", pt: "Escopo" })}><SelectValue /></SelectTrigger>
                <SelectContent>{scopes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button asChild variant="outline" className="gap-2">
              <Link to="/app/capital/engine"><ArrowLeft size={16} /> {tr({ en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" })}</Link>
            </Button>
          </>
        } />

      <p className="flex items-start gap-2.5 rounded-xl border tone-caution px-4 py-3 text-sm">
        <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{tr({
          en: "Every figure below is measured from the events each stage recorded — but on two inputs that are not yet field data: the pilot rate card is an assumption (staff time at R$ 30/h), and the demo's businesses, loans and timings are simulated. The pilot reprices the same four pairs at observed rates.",
          pt: "Cada número abaixo é medido pelos eventos que cada etapa registrou — mas sobre duas entradas que ainda não são dados de campo: a tabela do piloto é uma premissa (tempo de equipe a R$ 30/h), e os negócios, empréstimos e prazos da demonstração são simulados. O piloto reprecifica os mesmos quatro pares com taxas observadas.",
        })}</span>
      </p>

      {!d ? (
        <div className="space-y-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}</div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{tr({
            en: `${formatNumber(d.scope.participants)} participants in ${formatNumber(d.scope.communities)} communities · ${formatNumber(d.cost.opportunities)} qualified opportunities · ${formatNumber(d.cost.loans)} loans, ${money(d.cost.disbursed_cents)} lent.`,
            pt: `${formatNumber(d.scope.participants)} participantes em ${formatNumber(d.scope.communities)} comunidades · ${formatNumber(d.cost.opportunities)} oportunidades qualificadas · ${formatNumber(d.cost.loans)} empréstimos, ${money(d.cost.disbursed_cents)} emprestados.`,
          })}</p>
          {/* Who sells what comes before what anything costs: read the other
              way round, preparation looks like a cost of lending. */}
          <BusinessModel programId={programId} />
          <CostPair d={d} s={sensitivity.data} />
          {mobilization.data && <MobilizationPair d={d} m={mobilization.data} />}
          <TimePair d={d} />
          <ScalePair d={d} />
          <CapitalPair d={d} />
        </>
      )}
    </div>
  );
}
