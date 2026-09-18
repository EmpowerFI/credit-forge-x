import { ArrowRight, ChevronRight } from "lucide-react";
import type { RouteQuote, SettlementRouteResult } from "@empowerfi/settlement-route";
import { cn } from "@/lib/utils";
import StatusPill from "../../../components/product/StatusPill";
import { formatNumber, tr } from "../../../i18n";
import { bpsPercent } from "../../../lib/capital";
import { money } from "../../../lib/readiness";
import { REALITY } from "../../../lib/settlement";
import { eta, FX_STRUCK, ROUTE, ROUTE_REASON, type RouteReason } from "../../../lib/settlementRoute";
import { usdc } from "../../../lib/solana";

/** Milli-reais per USDC as a rate: three decimals, in the reader's own separators. */
const rate = (milli: number) => formatNumber(milli / 1000, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

// The settlement route, after the global pool wins: her loan is in reais, and
// these are the two ways the investors' dollars become those reais. Analysis
// only — the decision that binds is taken when the money moves.

function Quote({ q, chosen, grossForPrincipal }: { q: RouteQuote; chosen: boolean; grossForPrincipal: number | null }) {
  const route = ROUTE[q.route];
  const struck = FX_STRUCK[q.fx_struck];
  return (
    <div className={cn("flex h-full flex-col gap-3 rounded-2xl border p-4 transition-colors",
      chosen ? "border-positive/50 bg-positive/[0.06]" : q.feasible ? "border-border bg-background/20" : "border-caution/30")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-base font-bold text-foreground">{route.short}</p>
          <p className="text-xs text-muted-foreground">{q.hops === 1
            ? tr({ en: "One conversion", pt: "Uma conversão" })
            : tr({ en: "Two conversions", pt: "Duas conversões" })} · {eta(q.execution_eta_sec)}</p>
        </div>
        {chosen
          ? <StatusPill tone="positive" dot={false}>{tr({ en: "Selected", pt: "Selecionada" })}</StatusPill>
          : q.feasible
            ? <StatusPill tone="neutral" dot={false}>{tr({ en: "Feasible, not chosen", pt: "Viável, não escolhida" })}</StatusPill>
            : <StatusPill tone="caution" dot={false}>{tr({ en: "Cannot settle", pt: "Não pode liquidar" })}</StatusPill>}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {tr({ en: "Reaches her Pix", pt: "Chega no Pix dela" })}
        </p>
        <p className={cn("num font-heading text-2xl font-bold", chosen ? "text-positive" : "text-foreground")}>
          {money(q.net_brl_cents)}
        </p>
        <p className="num text-xs text-muted-foreground">
          {tr({
            en: `of ${money(q.gross_brl_cents)} released · ${bpsPercent(q.cost_bps)} in costs`,
            pt: `de ${money(q.gross_brl_cents)} liberados · ${bpsPercent(q.cost_bps)} em custos`,
          })}
        </p>
      </div>

      <dl className="num space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{tr({ en: "Exchange rate", pt: "Câmbio" })}</dt>
          <dd className="text-right text-foreground">
            R$ {rate(q.fx_rate_milli)}
            <span className="block text-[11px] font-normal text-muted-foreground">{struck.label}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{tr({ en: "Spread and fees", pt: "Spread e taxas" })}</dt>
          <dd className="text-foreground">{money(q.fx_cost_cents + q.provider_fee_cents + q.network_fee_cents)}</dd>
        </div>
        {grossForPrincipal != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{tr({ en: "To deliver her principal", pt: "Para entregar o principal dela" })}</dt>
            <dd className="text-foreground">{usdc(grossForPrincipal, 2)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <StatusPill tone={REALITY[q.reality === "sandbox" ? "sandbox" : "simulated"].tone} dot={false}>
          {REALITY[q.reality === "sandbox" ? "sandbox" : "simulated"].label}
        </StatusPill>
        {!q.feasible && q.blocks.map((b) => (
          <StatusPill key={b} tone={ROUTE_REASON[b as RouteReason].tone} dot={false}>{ROUTE_REASON[b as RouteReason].label}</StatusPill>
        ))}
      </div>
    </div>
  );
}

/** One line of the full comparison, route by route. */
function Row({ label, values }: { label: string; values: (string | null)[] }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted-foreground">{label}</th>
      {values.map((v, i) => <td key={i} className="num py-1.5 pl-3 text-right text-foreground">{v ?? "—"}</td>)}
    </tr>
  );
}

export default function SettlementRoute({ result }: { result: SettlementRouteResult }) {
  const quotes = result.quotes;
  const selected = result.selected;
  const winner = quotes.find((q) => q.route === selected) ?? null;
  const delta = result.net_brl_delta_cents;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-heading text-lg font-bold text-foreground">{tr({ en: "Settlement route", pt: "Rota de liquidação" })}</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {tr({
              en: "Global capital won, so the dollars have to become her reais. There are two ways, and they differ in where the exchange rate is struck.",
              pt: "O capital global venceu, então os dólares precisam virar os reais dela. Há duas formas, e elas diferem em onde o câmbio é fechado.",
            })}
          </p>
        </div>
        {winner && <StatusPill tone="positive" dot={false}>{ROUTE[winner.route].label}</StatusPill>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {quotes.map((q) => (
          <Quote key={q.route} q={q} chosen={q.route === selected} grossForPrincipal={result.gross_for_principal[q.route] ?? null} />
        ))}
      </div>

      <div className="space-y-2">
        <ul className="space-y-2">
          {result.reason_codes.map((r) => (
            <li key={r} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:gap-3">
              <span className="shrink-0"><StatusPill tone={ROUTE_REASON[r].tone} dot={false}>{ROUTE_REASON[r].label}</StatusPill></span>
              <span className="text-muted-foreground">{ROUTE_REASON[r].says}</span>
            </li>
          ))}
        </ul>
        {winner && delta !== null && delta > 0 && (
          <p className="num text-sm text-foreground">
            {tr({
              en: <>{money(delta)} more reaches her this way, on {usdc(result.compared_gross_micro_usdc, 0)} released.</>,
              pt: <>{money(delta)} a mais chegam a ela por este caminho, sobre {usdc(result.compared_gross_micro_usdc, 0)} liberados.</>,
            })}
          </p>
        )}
      </div>

      <p className="rounded-xl border tone-caution px-3 py-2 text-xs">
        {tr({
          en: "She receives her contracted principal whole whichever route pays it. What routing costs is what the vault must release to deliver it — never taken out of her Pix.",
          pt: "Ela recebe o principal contratado inteiro, seja qual for a rota que pagar. O que o roteamento custa é o que o cofre precisa liberar para entregá-lo — nunca é tirado do Pix dela.",
        })}
      </p>

      <details className="[&[open]>summary>svg]:rotate-90">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent hover:text-foreground">
          <ChevronRight size={14} className="transition-transform" aria-hidden />
          {tr({ en: "Why this route?", pt: "Por que esta rota?" })}
        </summary>
        <div className="space-y-3 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1.5 pr-3 text-left font-medium text-muted-foreground">
                  {tr({ en: "Priced at the same gross", pt: "Cotadas sobre o mesmo bruto" })}
                </th>
                {quotes.map((q) => (
                  <th key={q.route} scope="col" className="py-1.5 pl-3 text-right font-semibold text-foreground">{ROUTE[q.route].short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label={tr({ en: "Released", pt: "Liberado" })} values={quotes.map((q) => `${usdc(q.gross_micro_usdc, 0)} · ${money(q.gross_brl_cents)}`)} />
              <Row label={tr({ en: "Exchange rate", pt: "Câmbio" })} values={quotes.map((q) => `R$ ${rate(q.fx_rate_milli)}`)} />
              <Row label={tr({ en: "Rate struck", pt: "Câmbio fechado" })} values={quotes.map((q) => FX_STRUCK[q.fx_struck].label)} />
              <Row label={tr({ en: "Spread", pt: "Spread" })} values={quotes.map((q) => `${bpsPercent(q.fx_spread_bps)} · ${money(q.fx_cost_cents)}`)} />
              <Row label={tr({ en: "Provider fee", pt: "Taxa do provedor" })} values={quotes.map((q) => money(q.provider_fee_cents))} />
              <Row label={tr({ en: "Network", pt: "Rede" })} values={quotes.map((q) => money(q.network_fee_cents))} />
              <Row label={tr({ en: "Reaches her Pix", pt: "Chega no Pix dela" })} values={quotes.map((q) => money(q.net_brl_cents))} />
              <Row label={tr({ en: "Total cost", pt: "Custo total" })} values={quotes.map((q) => `${money(q.total_cost_cents)} · ${bpsPercent(q.cost_bps)}`)} />
              <Row label={tr({ en: "Settles in", pt: "Liquida em" })} values={quotes.map((q) => eta(q.execution_eta_sec))} />
              <Row label={tr({ en: "Quote valid until", pt: "Cotação válida até" })}
                values={quotes.map((q) => new Date(q.expires_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }))} />
              <Row label={tr({ en: "Can settle this ticket", pt: "Consegue liquidar este ticket" })}
                values={quotes.map((q) => q.feasible ? tr({ en: "yes", pt: "sim" }) : q.blocks.map((b) => ROUTE_REASON[b as RouteReason].label).join(" · "))} />
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: <>Feasibility first, then the reais she receives, then what it costs, then the number of conversions; speed breaks what is left. Rate cards are assumptions of this prototype. <span className="font-mono">{result.model_version}</span></>,
              pt: <>Primeiro a viabilidade, depois os reais que ela recebe, depois o custo, depois o número de conversões; a velocidade desempata o que sobrar. Os rate cards são premissas deste protótipo. <span className="font-mono">{result.model_version}</span></>,
            })}
          </p>
        </div>
      </details>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowRight size={12} aria-hidden />
        {tr({
          en: "Analysis only. The route that binds is priced and recorded when the desk disburses.",
          pt: "Apenas análise. A rota que vale é cotada e registrada quando a mesa desembolsa.",
        })}
      </p>
    </section>
  );
}
