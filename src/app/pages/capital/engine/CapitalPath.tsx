import { ArrowDown, ArrowRight } from "lucide-react";
import { Fragment } from "react";
import type { PoolId } from "@empowerfi/capital-allocation";
import type { SettlementRoute } from "@empowerfi/settlement-route";
import { cn } from "@/lib/utils";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";

interface Hop {
  label: string;
  note: string;
  reality: "real" | "simulated" | null;
}

const hops = (pool: PoolId, route: SettlementRoute | null): Hop[] =>
  pool === "global"
    ? [
      { label: tr({ en: "Global investor", pt: "Investidor global" }), note: tr({ en: "wallet on devnet", pt: "carteira na devnet" }), reality: "real" },
      { label: "USDC", note: tr({ en: "test USDC", pt: "USDC de teste" }), reality: "real" },
      { label: "Solana", note: tr({ en: "program vault, devnet", pt: "cofre do programa, devnet" }), reality: "real" },
      // The stablecoin route buys her reais here and holds them on chain; the
      // direct route converts only at the payout. Neither leg is real: a BRL
      // stablecoin on Solana is production-only, with no sandbox to run it in.
      ...(route === "brl_stable_pix"
        ? [{ label: tr({ en: "BRL stablecoin", pt: "Stablecoin de real" }), note: tr({ en: "rate locked at allocation", pt: "câmbio travado na alocação" }), reality: "simulated" as const },
           { label: tr({ en: "1:1 payout", pt: "Pagamento 1:1" }), note: tr({ en: "no exchange rate here", pt: "sem câmbio aqui" }), reality: "simulated" as const }]
        : [{ label: tr({ en: "Regulated off-ramp", pt: "Off-ramp regulado" }), note: tr({ en: "rate struck at payout", pt: "câmbio fechado no pagamento" }), reality: "simulated" as const }]),
      { label: "BRL / Pix", note: tr({ en: "mock Pix", pt: "Pix fictício" }), reality: "simulated" },
      { label: tr({ en: "Entrepreneur", pt: "Empreendedora" }), note: tr({ en: "repays in reais by Pix", pt: "paga em reais por Pix" }), reality: null },
    ]
    : [
      { label: tr({ en: "Brazilian P2P capital", pt: "Capital P2P brasileiro" }), note: tr({ en: "simulated BRL pool", pt: "pool em reais, simulado" }), reality: "simulated" },
      { label: "EmpowerFI", note: tr({ en: "P2P desk formalises", pt: "mesa P2P formaliza" }), reality: null },
      { label: "BRL / Pix", note: tr({ en: "mock Pix", pt: "Pix fictício" }), reality: "simulated" },
      { label: tr({ en: "Entrepreneur", pt: "Empreendedora" }), note: tr({ en: "repays in reais by Pix", pt: "paga em reais por Pix" }), reality: null },
    ];

/** Where the capital would travel on the selected route, each hop labelled real on devnet or simulated. */
export default function CapitalPath({ pool, route = null }: { pool: PoolId; route?: SettlementRoute | null }) {
  const list = hops(pool, route);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Capital path", pt: "Caminho do capital" })}</p>
      <ol className="flex flex-col items-stretch gap-1 md:flex-row md:flex-wrap md:items-center md:gap-1.5">
        {list.map((h, i) => (
          <Fragment key={h.label}>
            <li className={cn("rounded-xl border px-3 py-2 md:w-[9.5rem] animate-in fade-in slide-in-from-left-1 fill-mode-both",
              h.reality === "simulated" ? "border-dashed border-caution/40" : "border-border")}
              style={{ animationDelay: `${i * 90}ms`, animationDuration: "300ms" }}>
              <span className="block text-sm font-semibold leading-tight text-foreground">{h.label}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] leading-tight text-muted-foreground">{h.note}</span>
                {h.reality === "real" && <StatusPill tone="positive" dot={false}>{tr({ en: "Real · devnet", pt: "Real · devnet" })}</StatusPill>}
                {h.reality === "simulated" && <StatusPill tone="caution" dot={false}>{tr({ en: "Simulated", pt: "Simulado" })}</StatusPill>}
              </span>
            </li>
            {i < list.length - 1 && (
              <li aria-hidden className="flex justify-center text-accent">
                <ArrowDown size={14} className="md:hidden" /><ArrowRight size={14} className="hidden md:block" />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
