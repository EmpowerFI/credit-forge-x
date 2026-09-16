import { MapPin } from "lucide-react";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { bpsPercent } from "../../../lib/capital";
import type { EngineOpportunity } from "../../../lib/engine";
import { money, PURPOSE_LABEL, sectorLabel } from "../../../lib/readiness";
import { QUEUE_STATUS, queueStatus, statusTone } from "./status";
import { bandLetter } from "./labels";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="num truncate text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** The opportunity as the engines receive it: pseudonymous, derived, no figures of hers. */
export default function Snapshot({ o }: { o: EngineOpportunity }) {
  const s = queueStatus(o);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/30 p-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-base font-bold text-foreground">{o.code}</span>
        <StatusPill tone={statusTone(s)} dot={false}>{QUEUE_STATUS[s]}</StatusPill>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label={tr({ en: "Purpose", pt: "Finalidade" })} value={PURPOSE_LABEL[o.purpose as keyof typeof PURPOSE_LABEL] ?? o.purpose} />
        <Fact label={tr({ en: "Requested capital", pt: "Capital pedido" })} value={money(o.amount_cents)} />
        <Fact label={tr({ en: "Term", pt: "Prazo" })} value={tr({ en: `${o.term_months} months`, pt: `${o.term_months} meses` })} />
        <Fact label={tr({ en: "Readiness", pt: "Prontidão" })} value={tr({ en: `${o.readiness.score} / 100`, pt: `${o.readiness.score} / 100` })} />
        <Fact label={tr({ en: "Risk band", pt: "Faixa de risco" })} value={bandLetter(o.risk_band)} />
        <Fact label={tr({ en: "Affordability", pt: "Capacidade de pagamento" })}
          value={o.eligibility.affordability_bps === null ? "—" : tr({ en: `${bpsPercent(o.eligibility.affordability_bps)} of result`, pt: `${bpsPercent(o.eligibility.affordability_bps)} do resultado` })} />
      </dl>
      {(o.community || o.business_sector) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin size={12} aria-hidden />
          {[sectorLabel(o.business_sector), o.community, o.community_city && `${o.community_city}${o.community_state ? `, ${o.community_state}` : ""}`].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
