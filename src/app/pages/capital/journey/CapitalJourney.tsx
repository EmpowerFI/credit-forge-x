import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../../components/LoadError";
import PageEvidence from "../../../components/product/PageEvidence";
import PageHeader from "../../../components/product/PageHeader";
import Panel from "../../../components/product/Panel";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { prototypeNotice } from "../../../lib/capital";
import { MOVEMENT, MOVEMENTS, type Journey, type MovementKey, type Stage } from "../../../lib/capitalJourney";
import { EVIDENCE, weakest } from "../../../lib/evidence";
import { money } from "../../../lib/readiness";
import StageCard from "./StageCard";
import { useJourney } from "./queries";
import { useEngineOpportunities } from "../queries";

// The Capital Journey (addendum v3 §7.3).
//
// Every other screen here answers one question well, and none answers the whole
// one: where does a dollar committed abroad end up, and what did it do on the
// way. The Capital Network says which routes exist, the engine says which one a
// request took, the Investor Console says what an investor holds, the desk says
// what was disbursed, the Local Economy says what circulated afterwards. Nine
// screens, one arc, and nobody could see the arc.
//
// So: nine stages, each reading the records that stage actually wrote. Not a
// diagram of an intended architecture — a diagram would be free, and free is
// what makes it worthless. A stage with nothing in it says so.
//
// Two readings. The whole book, which is the honest aggregate. Or one request,
// which is the reading a demo needs: one woman's money, and each hop it took.
//
// The nine stages are grouped into the four movements of the loop, because the
// stages on their own were a list, and a list is what made this area read as
// several screens that happened to share a menu. The movements are the argument;
// the stages under them are what makes the argument checkable.

const ALL = "__all__";

const stagesOf = (j: Journey, k: MovementKey): Stage[] =>
  j.stages.filter((s) => (MOVEMENT[k].stages as string[]).includes(s.key));

/** How strong a movement's claim is: no stronger than its weakest stage. */
const evidenceOf = (stages: Stage[]) => EVIDENCE[weakest(stages.map((s) => s.evidence))];

/**
 * The spine: the whole loop in four figures, above anything that has to be
 * scrolled for. Each one is a link to the movement it summarises, so the four
 * numbers are also the page's table of contents.
 */
function Spine({ j }: { j: Journey }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {MOVEMENTS.map((k) => {
        const m = MOVEMENT[k];
        const label = evidenceOf(stagesOf(j, k));
        return (
          <li key={k} className="min-w-0">
            <a
              href={`#movement-${m.no}`}
              className="panel flex h-full min-w-0 flex-col gap-1.5 p-4 transition-colors hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="flex items-start gap-2">
                <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground" aria-hidden>
                  {m.no}
                </span>
                <span className="min-w-0 text-sm font-semibold text-foreground">{m.title}</span>
              </span>
              <span className="num font-heading text-2xl font-bold text-foreground">{money(m.figure(j))}</span>
              <span className="text-xs text-muted-foreground">{m.figureHint}</span>
              <span className="mt-auto pt-2">
                <StatusPill tone={label.tone} dot={false}>{label.label}</StatusPill>
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/** One movement: what it claims, and the stages that have to hold it up. */
function Movement({ j, k }: { j: Journey; k: MovementKey }) {
  const m = MOVEMENT[k];
  const stages = stagesOf(j, k);
  return (
    <section id={`movement-${m.no}`} className="scroll-mt-32 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex min-w-0 items-center gap-2 font-heading text-lg font-bold text-foreground">
          <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground" aria-hidden>
            {m.no}
          </span>
          {m.title}
        </h2>
        <p className="num text-sm text-muted-foreground">
          {money(m.figure(j))} <span className="text-xs">{m.figureHint}</span>
        </p>
      </div>
      <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">{m.claim}</p>
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stages.map((s) => <StageCard key={s.key} s={s} />)}
      </ol>
    </section>
  );
}

export default function CapitalJourney() {
  const [chosen, setChosen] = useState<string>(ALL);
  const opportunities = useEngineOpportunities();
  const journey = useJourney(chosen === ALL ? null : chosen);

  const rows = opportunities.data ?? [];
  const error = journey.error;
  const j = journey.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tr({ en: "Credit & Capital Operator", pt: "Operação de Crédito e Capital" })}
        title={tr({ en: "Capital Journey", pt: "Jornada do Capital" })}
        description={tr({
          en: "One economic loop, in four movements: global capital comes in, becomes credit in local currency, circulates in the territory, and comes back as stablecoin. Nine stages under them, each read from the records that stage wrote.",
          pt: "Um laço econômico, em quatro movimentos: o capital global entra, vira crédito em moeda local, circula no território e volta como stablecoin. Nove etapas embaixo deles, cada uma lida dos registros que aquela etapa escreveu.",
        })}
        meta={<PageEvidence />}
        about={
          <>
            <p>
              {tr({
                en: "Nothing on this screen is drawn. Every stage counts rows in the table that stage writes, and a stage with nothing in it says so rather than pointing an arrow at the next one. A diagram of an intended architecture would be free to make, and that is exactly what would make it worth nothing.",
                pt: "Nada nesta tela é desenhado. Cada etapa conta linhas na tabela que aquela etapa escreve, e uma etapa vazia diz isso em vez de apontar uma seta para a seguinte. Um diagrama de uma arquitetura pretendida seria de graça, e é justamente isso que o faria não valer nada.",
              })}
            </p>
            <p>
              {tr({
                en: "The four movements are deliberately uneven. Five of the nine stages happen before a single real exists, and they are the five a conventional impact fund also runs — origination, underwriting, allocation, funding, custody. The four that follow are the ones this product exists for. Splitting the nine into four bands of roughly equal size would read better and would hide exactly that.",
                pt: "Os quatro movimentos são desiguais de propósito. Cinco das nove etapas acontecem antes de existir um único real, e são as cinco que um fundo de impacto convencional também roda — originação, análise, alocação, captação, custódia. As quatro seguintes são aquelas para as quais este produto existe. Dividir as nove em quatro faixas de tamanho parecido ficaria melhor e esconderia justamente isso.",
              })}
            </p>
            <p>
              {tr({
                en: "Proof is reported beside the money and never stands in for it. A stage can be true and unanchored: the local rail writes no anchor at all, and the engine's plans are not anchored yet. Reporting nine of nine proven by leaving out the stages that prove nothing would be the easiest thing to do here.",
                pt: "A prova é informada ao lado do dinheiro e nunca no lugar dele. Uma etapa pode ser verdadeira e não registrada em cadeia: o trilho local não registra nada, e os planos do motor ainda não são registrados. Informar nove de nove provadas omitindo as etapas que não provam nada seria a coisa mais fácil de fazer aqui.",
              })}
            </p>
            <p>
              {tr({
                en: "Following one request narrows every stage to that request. What she traded is the capital that left and re-entered the account the disbursal credited. What her supplier paid a third merchant afterwards is shown beside it and never added to it — that balance is commingled the moment a second customer pays it, and claiming otherwise would be inventing a provenance.",
                pt: "Seguir um pedido estreita cada etapa àquele pedido. O que ela negociou é o capital que saiu e voltou à conta que o desembolso creditou. O que o fornecedor dela pagou a um terceiro comerciante depois aparece ao lado e nunca somado — aquele saldo se mistura no instante em que um segundo cliente paga, e dizer o contrário seria inventar uma procedência.",
              })}
            </p>
            <p>{prototypeNotice()}</p>
          </>
        }
        actions={
          <Select value={chosen} onValueChange={setChosen}>
            <SelectTrigger className="w-64" aria-label={tr({ en: "What to follow", pt: "O que seguir" })}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tr({ en: "The whole book", pt: "O livro inteiro" })}</SelectItem>
              {rows.map((o) => (
                <SelectItem key={o.opportunity_id} value={o.opportunity_id}>{o.code} · {money(o.amount_cents)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {error ? (
        <LoadError error={error} onRetry={() => void journey.refetch()} />
      ) : journey.isLoading || !j ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {j.focus && (
            <Panel
              title={tr({ en: `Following ${j.focus.code}`, pt: `Seguindo ${j.focus.code}` })}
              description={tr({
                en: `${money(j.focus.amount_cents)} asked for. Every stage below is narrowed to this one request.`,
                pt: `${money(j.focus.amount_cents)} pedidos. Cada etapa abaixo está estreitada a este único pedido.`,
              })}
            >
              <p className="text-sm text-muted-foreground">
                {tr({
                  en: "Which pool a plan recommends and which pool actually funds a request are two different decisions, taken at two different moments. Stage 3 is the recommendation and stage 4 is what happened, and they are allowed to differ.",
                  pt: "Qual pool um plano recomenda e qual pool de fato financia um pedido são duas decisões diferentes, tomadas em dois momentos diferentes. A etapa 3 é a recomendação e a etapa 4 é o que aconteceu, e elas podem divergir.",
                })}
              </p>
            </Panel>
          )}

          <Spine j={j} />

          {MOVEMENTS.map((k) => <Movement key={k} j={j} k={k} />)}
        </>
      )}
    </div>
  );
}
