import type { PoolId } from "@empowerfi/capital-allocation";
import { Network } from "lucide-react";
import { Link } from "react-router-dom";
import Panel from "../../../components/product/Panel";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { POOL } from "../../../lib/capital";
import type { EngineOpportunity } from "../../../lib/engine";
import { CapitalPlanPanel } from "../network/CapitalPlanPanel";

// The third question, under the first two.
//
// Engine 1 asked whether this request should exist; engine 2 asked which pool
// should fund it. Both answers are on this page, and on their own they read as
// if a pool were the whole of the network — which is the thesis this product
// argues against. A pool is one route. The capital network was asked the same
// request against every other one it has, and the answer it recorded belongs
// here, beside the pool's, rather than only on a page an operator has to know
// to visit.
//
// It is a recorded decision, not a re-run: the network engine writes, and
// re-running it from a page that says it writes nothing would be the wrong kind
// of surprise. So this reads what the database decided, says when, and says
// plainly when this browser's assumptions no longer agree with it.

/**
 * What the network was asked about, said in the pool's own name. A request no
 * pool has taken yet is not a gap in the record — it is the state where the
 * network is asked about both, and saying so is the point.
 */
function AskedAbout({ listed, chosen }: { listed: PoolId | null; chosen: PoolId | null }) {
  if (listed === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {tr({
          en: "No pool has taken this request yet, so the network was asked about both of them alongside every other route.",
          pt: "Nenhum pool assumiu este pedido ainda, então a rede foi perguntada sobre os dois, junto com todas as outras rotas.",
        })}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {tr({
          en: <>The network was asked about the <span className="font-medium text-foreground">{POOL[listed].name}</span> pool — the one the allocation engine listed this request on — and about every route that is not a pool at all.</>,
          pt: <>A rede foi perguntada sobre o pool <span className="font-medium text-foreground">{POOL[listed].name}</span> — aquele em que o motor de alocação listou este pedido — e sobre todas as rotas que não são pool nenhum.</>,
        })}
      </p>
      {chosen !== null && chosen !== listed && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <StatusPill tone="caution" dot={false}>{tr({ en: "Assumptions have moved", pt: "As premissas mudaram" })}</StatusPill>
          <span className="min-w-0 text-xs text-muted-foreground">
            {tr({
              en: `This run, on the assumptions in the drawer, chose ${POOL[chosen].name}. The plan below was routed for ${POOL[listed].name}, the pool the database listed it on: a recorded decision is a record, not a live view.`,
              pt: `Esta execução, com as premissas da gaveta, escolheu ${POOL[chosen].name}. O plano abaixo foi encaminhado para ${POOL[listed].name}, o pool em que o banco de dados o listou: uma decisão registrada é um registro, não uma visão ao vivo.`,
            })}
          </span>
        </p>
      )}
    </div>
  );
}

/** The recorded capital-network plan for this same request, under the pool's answer. */
export default function NetworkPlan({ o, chosen }: { o: EngineOpportunity; chosen: PoolId | null }) {
  const header = (
    <>
      <Network size={16} className="text-accent" aria-hidden />
      {tr({ en: "The rest of the network, on this same request", pt: "O resto da rede, sobre este mesmo pedido" })}
    </>
  );
  const description = tr({
    en: "A pool is one route among several. This is what the capital network recorded for this request across all of them — regional credit, microcredit, a productive exchange, capital from abroad — and the gap that none of the local ones could take.",
    pt: "Um pool é uma rota entre várias. Isto é o que a rede de capital registrou para este pedido em todas elas — crédito regional, microcrédito, troca produtiva, capital de fora — e a lacuna que nenhuma das locais pôde tomar.",
  });

  return (
    <CapitalPlanPanel
      opportunityId={o.opportunity_id}
      intro={
        <Panel title={<span className="flex items-center gap-2">{header}</span>} description={description}>
          <AskedAbout listed={o.funding_pool} chosen={chosen} />
        </Panel>
      }
      empty={
        <Panel title={<span className="flex items-center gap-2">{header}</span>} description={description}>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "The capital network has not been run on this request yet, so there is nothing recorded to show. Running it writes a decision, which is why it happens on its own page.",
              pt: "A rede de capital ainda não rodou sobre este pedido, então não há nada registrado para mostrar. Rodá-la grava uma decisão, e é por isso que isso acontece na página dela.",
            })}
          </p>
          <Link to={`/app/capital/network#run`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded">
            <Network size={14} aria-hidden />
            {tr({ en: "Open the Capital Network", pt: "Abrir a Rede de Capital" })}
          </Link>
        </Panel>
      }
    />
  );
}
