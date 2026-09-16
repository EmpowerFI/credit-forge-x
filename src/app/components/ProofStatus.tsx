import { CheckCircle2, ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { tr } from "../i18n";
import { explorerTx, type ChainAnchor } from "../lib/platform";

/** Where one fact stands on its way to the chain, with the proof once it is there. */
export default function ProofStatus({
  anchor,
  label,
  loading = false,
}: {
  anchor: ChainAnchor | undefined;
  label: string;
  /** While the proofs are still being fetched: never claim "not yet" before knowing. */
  loading?: boolean;
}) {
  if (!anchor) {
    return (
      <div className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{loading ? tr({ en: "Checking…", pt: "Verificando…" }) : tr({ en: "Not yet", pt: "Ainda não" })}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      {anchor.status === "confirmed" && anchor.signature ? (
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-positive">
            <CheckCircle2 size={14} /> {tr({ en: `On-chain · slot ${anchor.slot}`, pt: `Na blockchain · slot ${anchor.slot}` })}
          </span>
          <a href={explorerTx(anchor.signature)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-foreground">
            Explorer <ExternalLink size={12} />
          </a>
          <Link to={`/app/audit/${anchor.kind}/${anchor.entity_id}`} className="text-xs text-accent hover:text-foreground">
            {tr({ en: "Audit", pt: "Auditoria" })}
          </Link>
        </span>
      ) : anchor.status === "failed" ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive" title={anchor.last_error ?? ""}>
          <ShieldAlert size={14} /> {tr({ en: "Anchoring failed", pt: "Falha no registro na blockchain" })}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          {anchor.attempts > 1
            ? tr({ en: `Retrying on devnet (attempt ${anchor.attempts})`, pt: `Tentando de novo na devnet (tentativa ${anchor.attempts})` })
            : tr({ en: "Queued for devnet", pt: "Na fila para a devnet" })}
        </span>
      )}
    </div>
  );
}
