import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ANCHOR_DOMAINS, type AnchorKind } from "@empowerfi/audit-commitments";
import ProofResult from "../components/product/ProofResult";
import { tr } from "../i18n";
import { describeError } from "../lib/errors";
import { audit, KIND_TITLE } from "../lib/verify";

// The recompute-a-proof screen (PLAN_HACKATHON.md §G.4), at its own address:
// the same verification the proof drawer opens beside an event.

export default function AuditPage() {
  const { kind = "", entityId = "" } = useParams();
  const valid = kind in ANCHOR_DOMAINS;

  const result = useQuery({
    queryKey: ["platform", "audit", kind, entityId],
    enabled: valid,
    queryFn: () => audit(kind as AnchorKind, entityId),
    retry: false,
  });

  if (!valid) return <p className="text-muted-foreground">{tr({ en: "Unknown kind of proof.", pt: "Tipo de prova desconhecido." })}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> {tr({ en: "Back", pt: "Voltar" })}
      </button>

      <div className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">{tr({ en: "Audit", pt: "Auditoria" })}</p>
        <h1 className="font-heading text-3xl font-bold text-foreground">{KIND_TITLE[kind as AnchorKind]}</h1>
        <p className="text-muted-foreground">
          {tr({
            en: "Recomputed in your browser from the database record, and compared with the account on Solana Devnet.",
            pt: "Recalculado no seu navegador a partir do registro no banco de dados e comparado com a conta na Solana Devnet.",
          })}
        </p>
      </div>

      {result.isLoading && (
        <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={16} /> {tr({ en: "Recomputing and reading devnet…", pt: "Recalculando e lendo a devnet…" })}</p>
      )}
      {result.error && <p className="text-destructive">{describeError(result.error)}</p>}

      {result.data && <ProofResult result={result.data} />}

      <Link to="/app" className="text-sm text-accent">{tr({ en: "Home", pt: "Início" })}</Link>
    </div>
  );
}
