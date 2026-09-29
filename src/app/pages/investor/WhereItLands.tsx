import { useQuery } from "@tanstack/react-query";
import { ArrowDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, tr } from "../../i18n";
import { money } from "../../lib/readiness";
import { fetchRoutePreview, ROUTE } from "../../lib/settlementRoute";

// What her dollars become, said before she sends them.
//
// The crossing is the whole company in one step, and until now it was on a
// different screen from the moment it matters: an investor pressed Invest on
// dollars and read about reais later, in a panel called Payments. So the claim
// "global capital reaching a local economy" was something she was told rather
// than something she watched happen to her own money.
//
// Priced from the same preview the desk reads, scaled to her amount. It is a
// quote, not a promise: the route is decided again at disbursement, against the
// quotes live at that moment.

const usdcAmount = (micro: number) =>
  `${formatNumber(micro / 1e6, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;

export default function WhereItLands({ opportunityId, micro }: { opportunityId: string; micro: number }) {
  const preview = useQuery({
    queryKey: ["platform", "route-preview", opportunityId],
    queryFn: () => fetchRoutePreview(opportunityId),
    staleTime: 60_000,
  });

  if (preview.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  const p = preview.data;
  // Nothing to say rather than something vague: where the experiment is off, or
  // the request is not funded from abroad, no dollar crosses anything.
  if (!p || !p.enabled || !("applies" in p) || !p.applies || !("quotes" in p)) return null;

  const chosen = p.quotes.find((q) => q.route === p.selected);
  if (!chosen || micro <= 0) return null;

  // Her share of what the route delivers, at the rate it quoted.
  const lands = Math.round((micro * chosen.net_brl_cents) / chosen.gross_micro_usdc);
  const better = p.net_brl_delta_cents ?? 0;

  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <ol className="space-y-1">
        <li className="flex flex-wrap items-baseline gap-x-3">
          <span className="num w-32 shrink-0 font-heading text-lg font-bold text-foreground">{usdcAmount(micro)}</span>
          <span className="text-sm text-muted-foreground">{tr({ en: "from your wallet", pt: "da sua carteira" })}</span>
        </li>
        <li className="flex items-center gap-2 py-0.5 pl-1">
          <ArrowDown size={14} className="text-accent" aria-hidden />
          <span className="text-xs font-medium text-accent">{ROUTE[chosen.route].label}</span>
        </li>
        <li className="flex flex-wrap items-baseline gap-x-3">
          <span className="num w-32 shrink-0 font-heading text-lg font-bold text-foreground">{money(lands)}</span>
          <span className="text-sm text-muted-foreground">
            {tr({ en: "into the local credit fund", pt: "no fundo de crédito local" })}
          </span>
        </li>
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {better > 0
          ? tr({
            en: `The cheaper of two priced routes today — ${money(better)} more reais than the other, on the whole raise. Quoted now; the route is decided again when the desk disburses.`,
            pt: `A mais barata entre duas rotas precificadas hoje — ${money(better)} a mais em reais que a outra, sobre a captação inteira. Cotada agora; a rota é decidida de novo quando a mesa desembolsa.`,
          })
          : tr({
            en: "Quoted now; the route is decided again when the desk disburses, against the quotes live at that moment.",
            pt: "Cotada agora; a rota é decidida de novo quando a mesa desembolsa, contra as cotações vivas naquele momento.",
          })}
      </p>
    </div>
  );
}
