import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Coins, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { formatDate, formatNumber, tr } from "../../i18n";
import {
  eligibleWalletsKey, fetchEligibleWallets, fetchPositionHistory, fetchTokenizedPositions,
  POSITION_LIQUIDITY, POSITION_RELATION, POSITION_STATE, POSITION_TONE, positionDisclaimer,
  positionHistoryKey, positionNotBuilt, positionRoadmap, positionsKey,
  type PositionHistoryEntry, type TokenizedPosition,
} from "../../lib/positions";
import { money } from "../../lib/readiness";
import { shortAddress, usdc } from "../../lib/solana";

// The investor's assets: one per funded loan she is in.
//
// This list deliberately never totals them into a portfolio value. A position
// is worth what the loan repays, and nobody has bid for one — a sum here would
// read as a mark, which is the thing the addendum forbids.

function Row({ p }: { p: TokenizedPosition }) {
  return (
    <Link to={`/app/investor/assets/${p.id}`}
      className="panel flex flex-col gap-3 p-4 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="num flex flex-wrap items-center gap-2 font-heading text-base font-bold text-foreground">
          {p.asset}
          <StatusPill tone={POSITION_TONE[p.state]}>{POSITION_STATE[p.state]}</StatusPill>
          {p.is_simulated && (
            <span className="rounded-full border border-caution/35 px-2 py-0.5 text-[11px] font-medium text-caution">
              {tr({ en: "Simulated", pt: "Simulada" })}
            </span>
          )}
          {/* Only when she did not fund it: "invested" is what this console means. */}
          {POSITION_RELATION[p.relation] && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {POSITION_RELATION[p.relation]?.label}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {p.owner_wallet
            ? tr({ en: `Held by ${shortAddress(p.owner_wallet)}`, pt: `Em poder de ${shortAddress(p.owner_wallet)}` })
            : tr({ en: "No wallet yet", pt: "Ainda sem carteira" })}
          {" · "}
          {tr({
            en: `${formatNumber(p.share_bps / 100, { maximumFractionDigits: 2 })}% of the loan`,
            pt: `${formatNumber(p.share_bps / 100, { maximumFractionDigits: 2 })}% do empréstimo`,
          })}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num font-heading text-lg font-bold text-foreground">{money(p.principal_cents)}</p>
        <p className="num text-[11px] text-muted-foreground">
          {tr({ en: "her share, at origination", pt: "a parte dela, na originação" })}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{POSITION_LIQUIDITY[p.liquidity].label}</p>
      </div>
    </Link>
  );
}

/**
 * What this wallet held and handed on. Not a position — she is not party to
 * that credit any more — but the record of having been, which is hers and is
 * on Solana under her own signature.
 */
function Held({ entries, names }: { entries: PositionHistoryEntry[]; names: Map<string, string> }) {
  return (
    <Panel title={tr({ en: "Assets you have handed on", pt: "Ativos que você entregou" })}>
      <p className="pb-3 text-xs text-muted-foreground">{tr({
        en: "You no longer hold these, so what the loans behind them do now is not shown. This is the record of having held them.",
        pt: "Você não detém mais estes, então o que os empréstimos por trás deles fazem agora não é exibido. Isto é o registro de tê-los tido.",
      })}</p>
      <ul className="space-y-3">
        {entries.map((h) => (
          <li key={`${h.asset}-${h.handed_on_at}`}
            className="grid gap-1 border-b border-border/60 pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-baseline">
            <span className="min-w-0 space-y-0.5">
              <span className="num block text-sm font-medium text-foreground">
                {h.asset}
                <span className="ml-2 font-normal text-muted-foreground">
                  {formatNumber(h.share_bps / 100, { maximumFractionDigits: 2 })}% · {usdc(h.principal_micro_usdc)}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {h.received_at ? formatDate(h.received_at) : "—"}
                <ArrowRight size={12} aria-hidden />
                {formatDate(h.handed_on_at)}
                {" · "}
                {tr({
                  en: `to ${names.get(h.handed_on_to) ?? shortAddress(h.handed_on_to)}`,
                  pt: `para ${names.get(h.handed_on_to) ?? shortAddress(h.handed_on_to)}`,
                })}
              </span>
            </span>
            {h.handed_on_signature && (
              <ExplorerLink tx={h.handed_on_signature}
                label={tr({ en: "The transfer", pt: "A transferência" })} />
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function Positions() {
  const q = useQuery({ queryKey: positionsKey, queryFn: fetchTokenizedPositions });
  const history = useQuery({ queryKey: positionHistoryKey, queryFn: fetchPositionHistory });
  const wallets = useQuery({ queryKey: eligibleWalletsKey, queryFn: fetchEligibleWallets });
  const names = new Map((wallets.data ?? []).map((w) => [w.wallet, w.label]));

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={tr({ en: "Investor Console", pt: "Console do Investidor" })}
        title={tr({ en: "Tokenised positions", pt: "Posições tokenizadas" })}
        description={tr({
          en: "The borrower gets a loan. The investor gets a programmable credit asset.",
          pt: "A empreendedora recebe um empréstimo. A investidora recebe um ativo de crédito programável.",
        })}
        about={tr({
          en: "After an opportunity is fully funded, each investor's economic position becomes a Token-2022 asset on Solana Devnet, held in her own wallet. It can be sent to another wallet the platform has admitted — a token account for one of these assets is frozen until the platform thaws it, so transferability is enforced by the token program rather than by this screen.",
          pt: "Depois que uma oportunidade é totalmente financiada, a posição econômica de cada investidora vira um ativo Token-2022 na Devnet da Solana, guardado na carteira dela. Pode ser enviado a outra carteira que a plataforma tenha admitido — a conta de token de um desses ativos nasce congelada e só a plataforma descongela, então a transferibilidade é imposta pelo programa do token, não por esta tela.",
        })}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/app/investor/portfolio"><ArrowLeft size={16} /> {tr({ en: "Portfolio", pt: "Carteira" })}</Link>
          </Button>
        } />

      <p className="flex items-start gap-2.5 rounded-xl border tone-caution px-4 py-3 text-sm">
        <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{positionDisclaimer()}</span>
      </p>

      {q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Coins size={28} className="text-muted-foreground" aria-hidden />
          <p className="font-heading text-lg font-bold text-foreground">
            {tr({ en: "No positions yet", pt: "Nenhuma posição ainda" })}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">{tr({
            en: "An asset appears once an opportunity you funded reaches its target. Until then your money is an allocation, and you can see it in the portfolio.",
            pt: "Um ativo aparece quando uma oportunidade que você financiou atinge o alvo. Até lá seu dinheiro é uma alocação, e você a vê na carteira.",
          })}</p>
          <Button asChild className="mt-1">
            <Link to="/app/investor/opportunities">{tr({ en: "Browse opportunities", pt: "Ver oportunidades" })}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((p) => <Row key={p.id} p={p} />)}
        </div>
      )}

      {(history.data ?? []).length > 0 && <Held entries={history.data ?? []} names={names} />}

      <footer className="panel space-y-2 p-4 text-xs text-muted-foreground">
        <p className="font-heading text-sm font-bold text-foreground">
          {tr({ en: "What is not here", pt: "O que não existe aqui" })}
        </p>
        <p>{positionNotBuilt()}</p>
        <p>{positionRoadmap()}</p>
      </footer>
    </div>
  );
}
