import { useQuery } from "@tanstack/react-query";
import { Activity, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "../../i18n";
import { duration } from "../../lib/economics";
import { fetchFxMarket, FX_SOURCE_NAME, fxMarketKey, fxRate } from "../../lib/fx";
import { reaisRate } from "../../lib/settlement";

// What the market says right now, beside numbers that are priced in reais.
//
// The platform used to price everything at a fixed R$ 5.40; it now prices at
// what USDC actually fetches in Brazil, read every ten minutes from Mercado
// Bitcoin, with the Banco Central's PTAX beside it as the official reference.
// When the feed has stopped, this says the rate is an assumption rather than
// quietly pricing on yesterday.

export default function MarketRate({ className }: { className?: string }) {
  const market = useQuery({ queryKey: fxMarketKey, queryFn: fetchFxMarket, staleTime: 60_000, refetchInterval: 300_000 });
  const m = market.data;
  if (!m) return null;
  const usdc = fxRate(m, "USDC/BRL");
  const usd = fxRate(m, "USD/BRL");
  const live = m.in_use_source === "observed";

  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className={cn("inline-flex items-center gap-1.5 font-medium", live ? "text-positive" : "text-caution")}>
        {live ? <Activity size={13} aria-hidden /> : <TriangleAlert size={13} aria-hidden />}
        {live ? tr({ en: "Market rate", pt: "Câmbio de mercado" }) : tr({ en: "No recent quote", pt: "Sem cotação recente" })}
      </span>
      {live && usdc ? (
        <span className="num text-foreground">
          USDC/BRL {reaisRate(usdc.mid_milli, 3)}
          <span className="font-normal text-muted-foreground">
            {" "}· {FX_SOURCE_NAME[usdc.source]} · {tr({ en: `${duration(usdc.age_seconds)} ago`, pt: `há ${duration(usdc.age_seconds)}` })}
          </span>
        </span>
      ) : (
        <span className="num text-foreground">
          {reaisRate(m.fallback_milli, 2)}
          <span className="font-normal text-muted-foreground"> · {tr({ en: "the stated assumption", pt: "a premissa declarada" })}</span>
        </span>
      )}
      {usd && (
        <span className="num">
          {tr({ en: "US$ reference", pt: "Dólar de referência" })} {reaisRate(usd.mid_milli, 3)}
          <span className="font-normal"> · {FX_SOURCE_NAME[usd.source]}</span>
        </span>
      )}
    </p>
  );
}
