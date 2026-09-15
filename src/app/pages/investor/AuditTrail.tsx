import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import DataLegend from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { PROOF_LABEL } from "../../lib/investor";
import { useProofs } from "./queries";

// Every proof behind your positions, each one a click from being recomputed
// in your browser against Solana.

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function AuditTrail() {
  const proofs = useProofs();
  const rows = proofs.data ?? [];
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const verified = rows.filter((r) => r.reconcile === "verified").length;
  const problems = rows.filter((r) => r.reconcile === "missing" || r.reconcile === "mismatch").length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Investor console" title="Audit trail"
        description="Your allocations, and the loans they fund — terms, status changes, payments. Each proof holds a hash of the record, never the record; open one and your browser recomputes it." />
      <DataLegend />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Proofs" value={rows.length} />
        <StatTile label="On Solana" value={confirmed} hintTone="positive" hint={rows.length ? `${Math.round((confirmed / rows.length) * 100)}%` : undefined} />
        <StatTile label="Re-checked by reconciliation" value={verified} hintTone="positive" />
        <StatTile label="Discrepancies" value={problems} hintTone={problems ? "alert" : "neutral"} hint={problems ? "see below" : "none"} />
      </div>

      <Panel>
        {proofs.isPending && <Skeleton className="h-48 rounded-xl bg-secondary" />}
        {proofs.isError && <LoadError compact error={proofs.error} onRetry={() => proofs.refetch()} />}
        {proofs.data && rows.length === 0 && <p className="text-sm text-muted-foreground">No proofs yet: invest to start your trail.</p>}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Proof</th>
                <th className="py-2 pr-4 font-medium">Opportunity</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Transaction</th>
                <th className="py-2 pr-4 font-medium">Confirmed</th>
                <th className="py-2 font-medium"><span className="sr-only">Verify</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.entity_id}`}>
                  <td className="py-2.5 pr-4 text-foreground">{PROOF_LABEL[r.kind] ?? r.kind}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{r.code}</td>
                  <td className="py-2.5 pr-4">
                    <StatusPill tone={r.reconcile === "mismatch" || r.reconcile === "missing" ? "alert" : r.status === "confirmed" ? "positive" : "caution"}>
                      {r.reconcile === "verified" ? "Verified" : r.reconcile === "mismatch" ? "Mismatch" : r.reconcile === "missing" ? "Missing" : r.status === "confirmed" ? "On-chain" : "Queued"}
                    </StatusPill>
                  </td>
                  <td className="py-2.5 pr-4">{r.signature ? <ExplorerLink tx={r.signature} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{when(r.confirmed_at)}</td>
                  <td className="py-2.5 text-right">
                    <Link to={`/app/audit/${r.kind}/${r.entity_id}`} className="inline-flex items-center gap-1 text-xs text-positive hover:underline">
                      <BadgeCheck size={13} /> Verify on Solana
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
