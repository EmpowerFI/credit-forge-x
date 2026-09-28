import { useState } from "react";
import { Banknote, Globe2, Sprout } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../../components/LoadError";
import PageEvidence from "../../../components/product/PageEvidence";
import PageHeader from "../../../components/product/PageHeader";
import Panel from "../../../components/product/Panel";
import StatTile from "../../../components/product/StatTile";
import { tr } from "../../../i18n";
import { prototypeNotice } from "../../../lib/capital";
import type { Journey } from "../../../lib/capitalJourney";
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

const ALL = "__all__";

function Arc({ j }: { j: Journey }) {
  // Of what reached her, how much stayed in the territory. The multiplier lives
  // on the Local Economy screen; this is the blunter question — did any of it
  // stay at all.
  const stayed = j.disbursed_cents > 0
    ? Math.round((j.circulated_cents * 100) / j.disbursed_cents)
    : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatTile
        label={tr({ en: "Committed to the book", pt: "Comprometido com o livro" })}
        value={money(j.committed_cents)}
        hint={tr({ en: "by investors, simulated", pt: "por investidores, simulado" })}
        hintTone="info"
        icon={<Globe2 size={14} aria-hidden />}
      />
      <StatTile
        label={tr({ en: "Reached a business", pt: "Chegou a um negócio" })}
        value={money(j.disbursed_cents)}
        hint={tr({ en: "disbursed by Pix", pt: "desembolsado por Pix" })}
        icon={<Banknote size={14} aria-hidden />}
      />
      <StatTile
        label={tr({ en: "Traded inside the territory", pt: "Negociado dentro do território" })}
        value={money(j.circulated_cents)}
        hint={j.disbursed_cents > 0
          ? tr({ en: `${stayed}% of what reached her`, pt: `${stayed}% do que chegou a ela` })
          : tr({ en: "nothing has been disbursed", pt: "nada foi desembolsado" })}
        hintTone={j.circulated_cents > 0 ? "positive" : "neutral"}
        icon={<Sprout size={14} aria-hidden />}
      />
    </div>
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
          en: "Where a dollar committed abroad ends up, and what it did on the way. Nine stages, each read from the records that stage wrote.",
          pt: "Onde um dólar comprometido lá fora vai parar, e o que ele fez no caminho. Nove etapas, cada uma lida dos registros que aquela etapa escreveu.",
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

          <Arc j={j} />

          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {j.stages.map((s) => <StageCard key={s.key} s={s} />)}
          </ol>
        </>
      )}
    </div>
  );
}
