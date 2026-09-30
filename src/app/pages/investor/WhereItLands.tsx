import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "../../i18n";
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
    <div className="space-y-2 border-y border-border py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{tr({ en: "She receives", pt: "Ela recebe" })}</span>
        <span className="num font-heading text-2xl font-bold text-foreground">{money(lands)}</span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{tr({ en: "Route", pt: "Rota" })}</span>
        <span className="text-foreground">{ROUTE[chosen.route].label}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {better > 0
          ? tr({
            en: `The cheaper of two priced routes today — ${money(better)} more for her across the whole raise. Decided again when the desk disburses.`,
            pt: `A mais barata entre duas rotas precificadas hoje — ${money(better)} a mais para ela na captação inteira. Decidida de novo quando a mesa desembolsa.`,
          })
          : tr({
            en: "Quoted now, and decided again when the desk disburses.",
            pt: "Cotada agora, e decidida de novo quando a mesa desembolsa.",
          })}
      </p>
    </div>
  );
}
