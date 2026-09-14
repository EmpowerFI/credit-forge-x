import { CheckCircle2, ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { explorerTx, type ChainAnchor } from "../lib/platform";

/** Where one fact stands on its way to the chain, with the proof once it is there. */
export default function ProofStatus({ anchor, label }: { anchor: ChainAnchor | undefined; label: string }) {
  if (!anchor) {
    return (
      <div className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">Not yet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      {anchor.status === "confirmed" && anchor.signature ? (
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={14} /> On-chain · slot {anchor.slot}
          </span>
          <a href={explorerTx(anchor.signature)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-foreground">
            Explorer <ExternalLink size={12} />
          </a>
          <Link to={`/app/audit/${anchor.kind}/${anchor.entity_id}`} className="text-xs text-accent hover:text-foreground">
            Audit
          </Link>
        </span>
      ) : anchor.status === "failed" ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive" title={anchor.last_error ?? ""}>
          <ShieldAlert size={14} /> Anchoring failed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          {anchor.attempts > 1 ? `Retrying on devnet (attempt ${anchor.attempts})` : "Queued for devnet"}
        </span>
      )}
    </div>
  );
}
