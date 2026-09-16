import { Link } from "react-router-dom";
import { localized, tr } from "../../i18n";
import { DataTag } from "./DataLegend";
import ExplorerLink from "./ExplorerLink";
import StatusPill from "./StatusPill";

/** A proof on its way to the chain; the status itself is the database's value. */
const PROOF_STATUS: Record<string, string> = localized({
  pending: { en: "Proof pending", pt: "Prova pendente" },
  submitted: { en: "Proof submitted", pt: "Prova enviada" },
  failed: { en: "Proof failed", pt: "Prova com falha" },
});

export interface ProofRef { kind: string; entity_id: string; status: string; signature: string | null }

/** One fact's proof in a line: proven with its transaction and a way to verify it, or where it stands. */
export default function ProofLine({ proof, empty = tr({ en: "Not queued", pt: "Fora da fila" }) }: { proof: ProofRef | null | undefined; empty?: string }) {
  if (!proof) return <StatusPill tone="neutral">{empty}</StatusPill>;
  if (proof.status !== "confirmed") return <StatusPill tone="caution">{PROOF_STATUS[proof.status] ?? tr({ en: `Proof ${proof.status}`, pt: `Prova ${proof.status}` })}</StatusPill>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <DataTag kind="proven" withLabel />
      {proof.signature && <ExplorerLink tx={proof.signature} />}
      <Link to={`/app/audit/${proof.kind}/${proof.entity_id}`} className="text-info hover:underline">{tr({ en: "Verify", pt: "Verificar" })}</Link>
    </span>
  );
}
