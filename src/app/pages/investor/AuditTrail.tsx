import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, tr } from "../../i18n";
import LoadError from "../../components/LoadError";
import DataLegend from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import PageEvidence from "../../components/product/PageEvidence";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { PROOF_LABEL } from "../../lib/investor";
import { useProofs } from "./queries";
import VerifyButton from "../../components/proof/VerifyButton";
import type { AnchorKind } from "../../lib/platform";

// Every proof behind your positions, each one a click from being recomputed
// in your browser against Solana.

const when = (iso: string | null) => (iso ? formatDateTime(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function AuditTrail() {
  const proofs = useProofs();
  const rows = proofs.data ?? [];
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const verified = rows.filter((r) => r.reconcile === "verified").length;
  const problems = rows.filter((r) => r.reconcile === "missing" || r.reconcile === "mismatch").length;

  return (
    <div className="space-y-6">
      <PageHeader
        meta={<PageEvidence family="solana_anchors" />}
        eyebrow={tr({ en: "Investor console", pt: "Console do investidor" })} title={tr({ en: "Audit trail", pt: "Trilha de auditoria" })}
        description={tr({
          en: "Your allocations, and the loans they fund — terms, status changes, payments. Each proof holds a hash of the record, never the record; open one and your browser recomputes it.",
          pt: "Suas alocações e os empréstimos que elas financiam: condições, mudanças de status, pagamentos. Cada prova guarda um hash do registro, nunca o registro; abra uma e o seu navegador refaz o cálculo.",
        })} />
      <DataLegend />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={tr({ en: "Proofs", pt: "Provas" })} value={rows.length} />
        <StatTile label={tr({ en: "On Solana", pt: "Na Solana" })} value={confirmed} hintTone="positive" hint={rows.length ? `${Math.round((confirmed / rows.length) * 100)}%` : undefined} />
        <StatTile label={tr({ en: "Re-checked by reconciliation", pt: "Conferidas na conciliação" })} value={verified} hintTone="positive" />
        <StatTile label={tr({ en: "Discrepancies", pt: "Divergências" })} value={problems} hintTone={problems ? "alert" : "neutral"}
          hint={problems ? tr({ en: "see below", pt: "veja abaixo" }) : tr({ en: "none", pt: "nenhuma" })} />
      </div>

      <Panel>
        {proofs.isPending && <Skeleton className="h-48 rounded-xl bg-secondary" />}
        {proofs.isError && <LoadError compact error={proofs.error} onRetry={() => proofs.refetch()} />}
        {proofs.data && rows.length === 0 && <p className="text-sm text-muted-foreground">{tr({ en: "No proofs yet: invest to start your trail.", pt: "Nenhuma prova ainda: invista para começar a sua trilha." })}</p>}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{tr({ en: "Proof", pt: "Prova" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Opportunity", pt: "Oportunidade" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Status", pt: "Status" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Transaction", pt: "Transação" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Confirmed", pt: "Confirmada em" })}</th>
                <th className="py-2 font-medium"><span className="sr-only">{tr({ en: "Verify", pt: "Verificar" })}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.entity_id}`}>
                  <td className="py-2.5 pr-4 text-foreground">{PROOF_LABEL[r.kind] ?? r.kind}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{r.code}</td>
                  <td className="py-2.5 pr-4">
                    <StatusPill tone={r.reconcile === "mismatch" || r.reconcile === "missing" ? "alert" : r.status === "confirmed" ? "positive" : "caution"}>
                      {r.reconcile === "verified" ? tr({ en: "Verified", pt: "Verificada" })
                        : r.reconcile === "mismatch" ? tr({ en: "Mismatch", pt: "Divergente" })
                        : r.reconcile === "missing" ? tr({ en: "Missing", pt: "Ausente" })
                        : r.status === "confirmed" ? tr({ en: "On-chain", pt: "Na blockchain" })
                        : tr({ en: "Queued", pt: "Na fila" })}
                    </StatusPill>
                  </td>
                  <td className="py-2.5 pr-4">{r.signature ? <ExplorerLink tx={r.signature} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{when(r.confirmed_at)}</td>
                  <td className="py-2.5 text-right">
                    <VerifyButton icon className="text-xs text-positive" proof={{
                      kind: r.kind as AnchorKind, entity_id: r.entity_id, status: r.status, signature: r.signature, confirmed_at: r.confirmed_at,
                    }} />
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
