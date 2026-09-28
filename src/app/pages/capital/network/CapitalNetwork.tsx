import { Globe2, HandCoins, Handshake, Network } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../../auth/useAuth";
import LoadError from "../../../components/LoadError";
import PageEvidence from "../../../components/product/PageEvidence";
import PageHeader from "../../../components/product/PageHeader";
import Panel from "../../../components/product/Panel";
import StatTile from "../../../components/product/StatTile";
import { tr } from "../../../i18n";
import { prototypeNotice } from "../../../lib/capital";
import { GATE } from "../../../lib/capitalNetwork";
import CapitalOrigin from "./CapitalOrigin";
import Instruments from "./Instruments";
import Providers from "./Providers";
import RunEngine from "./RunEngine";
import { useInstruments, useProviders } from "./queries";
import { useEngineOpportunities } from "../queries";

// The Capital Network. A business needs capital, and a loan is one of the
// answers rather than the answer: a regional product for part of it, a
// microcredit line for another, a productive exchange inside a network for the
// rest, and the two P2P pools for what local capacity cannot absorb.
//
// Everything on this screen is advisory. The routes that are not pools never
// create an investment, never mint a position and never touch a loan; they
// produce a recommendation and a status, and approval stays with whoever owns
// the product. The pool routes keep writing exactly what they wrote before this
// page existed, so a plan changes nothing downstream of funding_pool.

export default function CapitalNetwork() {
  const { profile } = useAuth();
  const providers = useProviders();
  const instruments = useInstruments();
  const opportunities = useEngineOpportunities();

  const canEdit = profile?.role === "capital_provider" || profile?.role === "admin";
  const rows = instruments.data ?? [];
  const open = rows.filter((i) => i.active);
  const error = providers.error ?? instruments.error;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tr({ en: "Credit & Capital Operator", pt: "Operação de Crédito e Capital" })}
        title={tr({ en: "Capital Network", pt: "Rede de Capital" })}
        description={tr({
          en: "Every instrument the network can route to, the policy each is offered under, and what the engine would do with one qualified need.",
          pt: "Todo instrumento ao qual a rede pode encaminhar, a política de cada um e o que o motor faria com uma necessidade qualificada.",
        })}
        meta={<PageEvidence family="partner_routes" />}
        about={
          <>
            <p>
              {tr({
                en: "Hard gates first, weights second. Seven gates decide whether a route may take this need at all — where she is, the ticket, the purpose, her reported history, her papers, what she can pay and what the route has left — and each is shown with both sides of its comparison. Only then does a fit score rank the routes that survived, and no weight can overturn a gate.",
                pt: "Portões rígidos primeiro, pesos depois. Sete portões decidem se uma rota pode atender esta necessidade, e cada um é mostrado com os dois lados da comparação. Só então uma pontuação de encaixe classifica as rotas que sobraram, e nenhum peso derruba um portão.",
              })}
            </p>
            <ul className="space-y-1">
              {(Object.keys(GATE) as (keyof typeof GATE)[]).map((g) => (
                <li key={g}>
                  <span className="text-foreground">{GATE[g].label}</span> — {GATE[g].asks}
                </li>
              ))}
            </ul>
            <p>
              {tr({
                en: "Local capital first, global capital for the residual. Domestic routes are allocated before any global route is offered anything, so the external capital gap is a measurement of the domestic network taken before global money can hide it.",
                pt: "Capital local primeiro, capital global para o resíduo. As rotas domésticas são alocadas antes de qualquer rota global receber algo, então a lacuna de capital externo é uma medida da rede doméstica feita antes de o dinheiro global poder escondê-la.",
              })}
            </p>
            <p>
              {tr({
                en: "A match is never an approval. Every route whose owner still has to decide says so on its card, and nothing on this screen creates a loan, an investment or a position. The two P2P routes read their ticket range, purposes, mandate and capacity from funding_pools, and their cost from the engine that already prices them, so this page and the Investor Console cannot disagree about a pool.",
                pt: "Um encaixe nunca é uma aprovação. Toda rota cujo dono ainda precisa decidir diz isso no próprio cartão, e nada nesta tela cria empréstimo, investimento ou posição. As duas rotas P2P leem faixa de ticket, finalidades, mandato e capacidade de funding_pools, e o custo do motor que já as precifica, então esta página e o Console do Investidor não podem discordar sobre um pool.",
              })}
            </p>
            <p>{prototypeNotice()}</p>
          </>
        }
      />

      {error ? (
        <LoadError error={error} onRetry={() => { void providers.refetch(); void instruments.refetch(); }} />
      ) : instruments.isLoading || providers.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={tr({ en: "Routes open", pt: "Rotas abertas" })}
              value={open.length}
              hint={rows.length > open.length ? tr({ en: `${rows.length - open.length} closed`, pt: `${rows.length - open.length} fechadas` }) : undefined}
              icon={<Network size={14} aria-hidden />}
            />
            <StatTile
              label={tr({ en: "Providers", pt: "Provedores" })}
              value={(providers.data ?? []).length}
              hint={tr({ en: "all simulated", pt: "todos simulados" })}
              hintTone="caution"
              icon={<HandCoins size={14} aria-hidden />}
            />
            <StatTile
              label={tr({ en: "Global routes", pt: "Rotas globais" })}
              value={open.filter((i) => i.is_global).length}
              hint={tr({ en: "for the residual only", pt: "só para o resíduo" })}
              hintTone="info"
              icon={<Globe2 size={14} aria-hidden />}
            />
            <StatTile
              label={tr({ en: "Not credit", pt: "Não são crédito" })}
              value={open.filter((i) => !i.is_credit).length}
              hint={tr({ en: "never described as a loan", pt: "nunca descritas como empréstimo" })}
              hintTone="caution"
              icon={<Handshake size={14} aria-hidden />}
            />
          </div>

          {/* Counting routes says nothing about which of them carries money.
              The book does, and the thesis of this page lives or dies on it. */}
          <CapitalOrigin />

          <RunEngine
            opportunities={opportunities.data ?? []}
            instruments={rows}
            loading={opportunities.isLoading}
          />

          <Instruments instruments={rows} providers={providers.data ?? []} canEdit={canEdit} />
          <Providers providers={providers.data ?? []} />

          <Panel title={tr({ en: "What this does not do", pt: "O que isto não faz" })}>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>{tr({
                en: "It does not underwrite, approve or promise credit. Every partner route carries “Partner approval required”.",
                pt: "Não faz análise de crédito, não aprova e não promete crédito. Toda rota de parceiro carrega “Requer aprovação do parceiro”.",
              })}</li>
              <li>{tr({
                en: "It does not bill a partner fee. A provider's commercial model is recorded as metadata and nothing acts on it.",
                pt: "Não cobra taxa de parceiro. O modelo comercial de um provedor é registrado como metadado e nada age sobre ele.",
              })}</li>
              <li>{tr({
                en: "It does not change how a loan, an investment, a settlement or a tokenized position works.",
                pt: "Não muda como funciona um empréstimo, um investimento, uma liquidação ou uma posição tokenizada.",
              })}</li>
              <li>
                {tr({ en: "Which pool funds an opportunity is still decided when it opens to investors — see", pt: "Qual pool financia uma oportunidade continua sendo decidido quando ela abre a investidores — veja" })}{" "}
                <Link to="/app/capital" className="text-accent hover:text-foreground">
                  {tr({ en: "the Credit & Capital Engine", pt: "o Motor de Crédito e Capital" })}
                </Link>.
              </li>
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
