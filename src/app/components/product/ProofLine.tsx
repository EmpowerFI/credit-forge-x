import { Link } from "react-router-dom";
import { DataTag } from "./DataLegend";
import ExplorerLink from "./ExplorerLink";
import StatusPill from "./StatusPill";

export interface ProofRef { kind: string; entity_id: string; status: string; signature: string | null }

/** One fact's proof in a line: proven with its transaction and a way to verify it, or where it stands. */
export default function ProofLine({ proof, empty = "Not queued" }: { proof: ProofRef | null | undefined; empty?: string }) {
  if (!proof) return <StatusPill tone="neutral">{empty}</StatusPill>;
  if (proof.status !== "confirmed") return <StatusPill tone="caution">Proof {proof.status}</StatusPill>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <DataTag kind="proven" withLabel />
      {proof.signature && <ExplorerLink tx={proof.signature} />}
      <Link to={`/app/audit/${proof.kind}/${proof.entity_id}`} className="text-info hover:underline">Verify</Link>
    </span>
  );
}
