import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime, tr } from "../../i18n";
import { describeError } from "../../lib/errors";
import { audit, KIND_TITLE } from "../../lib/verify";
import { DataTag } from "../product/DataLegend";
import ExplorerLink from "../product/ExplorerLink";
import PoolPill from "../product/PoolPill";
import ProofResult from "../product/ProofResult";
import StatusPill from "../product/StatusPill";
import VerifyOnSolana from "../product/VerifyOnSolana";
import { ProofDrawerContext, type ProofTarget } from "./context";

const STATUS_TONE: Record<string, "positive" | "caution" | "alert"> = { confirmed: "positive", pending: "caution", submitted: "caution", failed: "alert" };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-3 py-2 text-sm">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

/**
 * A proof beside the event it proves (refactor spec §7): what was proven, when,
 * under which model, its commitment and its devnet transaction. Anyone can
 * check the commitment on Solana; a viewer allowed to read the record also sees
 * it recomputed in this browser. The chain holds only the hash.
 */
function Drawer({ proof, onClose }: { proof: ProofTarget | null; onClose: () => void }) {
  const record = useQuery({
    queryKey: ["platform", "audit", proof?.kind, proof?.entity_id],
    enabled: Boolean(proof?.entity_id),
    queryFn: () => audit(proof!.kind, proof!.entity_id!),
    retry: false,
  });
  const denied = (record.error as { code?: string } | null)?.code === "42501";
  const anchor = record.data?.record.anchor;
  const payload = record.data?.record.payload;
  const p = proof && {
    ...proof,
    status: proof.status ?? anchor?.status ?? null,
    signature: proof.signature ?? anchor?.signature ?? null,
    account: proof.account ?? anchor?.account_address ?? null,
    commitment: proof.commitment ?? anchor?.commitment ?? null,
    confirmed_at: proof.confirmed_at ?? anchor?.confirmed_at ?? null,
    model_version: proof.model_version ?? (payload?.model_version as string | undefined) ?? (payload?.text_version as string | undefined) ?? null,
  };

  return (
    <Sheet open={proof !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-border bg-background sm:max-w-xl">
        {p && (
          <div className="space-y-6">
            <SheetHeader className="space-y-2 text-left">
              <p className="text-xs font-medium uppercase tracking-widest text-accent">{tr({ en: "Proof", pt: "Prova" })}</p>
              <SheetTitle className="font-heading text-2xl text-foreground">{KIND_TITLE[p.kind]}</SheetTitle>
              <SheetDescription>
                {tr({
                  en: "Evidence without financial surveillance: Solana holds a hash of this record, never the person, her documents, Pix details or figures.",
                  pt: "Evidência sem vigilância financeira: a Solana guarda um hash deste registro, nunca a pessoa, seus documentos, dados de Pix ou valores.",
                })}
              </SheetDescription>
            </SheetHeader>

            <dl className="divide-y divide-border rounded-xl border border-border bg-card/40 px-4">
              <Fact label={tr({ en: "Status", pt: "Situação" })}>
                {p.status
                  ? <span className="inline-flex flex-wrap items-center gap-2">
                    <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status === "confirmed" ? tr({ en: "On Solana devnet", pt: "Na devnet da Solana" }) : p.status}</StatusPill>
                    {p.status === "confirmed" && <DataTag kind="proven" withLabel />}
                  </span>
                  : record.isLoading ? <Loader2 size={14} className="animate-spin text-muted-foreground" /> : "—"}
              </Fact>
              {p.subject && <Fact label={tr({ en: "Pseudonymous id", pt: "Id pseudônimo" })}><span className="font-mono">{p.subject}</span></Fact>}
              <Fact label={tr({ en: "Event type", pt: "Tipo de evento" })}><span className="font-mono text-xs">{p.kind}</span></Fact>
              {p.entity_id && <Fact label={tr({ en: "Record id", pt: "Id do registro" })}><span className="break-all font-mono text-xs">{p.entity_id}</span></Fact>}
              {p.model_version && <Fact label={tr({ en: "Model / engine", pt: "Modelo / motor" })}><span className="font-mono text-xs">{p.model_version}</span></Fact>}
              {p.route !== undefined && <Fact label={tr({ en: "Selected route", pt: "Rota escolhida" })}><PoolPill pool={p.route ?? null} /></Fact>}
              <Fact label={tr({ en: "Anchored", pt: "Registrada" })}>{p.confirmed_at ? formatDateTime(p.confirmed_at) : "—"}</Fact>
              <Fact label={tr({ en: "Commitment", pt: "Compromisso" })}><span className="break-all font-mono text-xs">{p.commitment ?? "—"}</span></Fact>
              <Fact label={tr({ en: "Devnet transaction", pt: "Transação na devnet" })}>{p.signature ? <ExplorerLink tx={p.signature} /> : "—"}</Fact>
              {p.account && <Fact label={tr({ en: "Account", pt: "Conta" })}><ExplorerLink address={p.account} /></Fact>}
            </dl>

            {p.signature && p.commitment && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{tr({
                  en: "Checks, from this browser and without EmpowerFI's servers, that this commitment is on Solana.",
                  pt: "Confere, deste navegador e sem os servidores da EmpowerFI, que este compromisso está na Solana.",
                })}</p>
                <VerifyOnSolana proofs={[{ kind: p.kind, signature: p.signature, account: p.account, commitment: p.commitment }]} size="default" />
              </div>
            )}

            {p.entity_id && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {tr({ en: "Recomputed from the record", pt: "Recalculada a partir do registro" })}
                </h3>
                {record.isLoading && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" /> {tr({ en: "Recomputing and reading devnet…", pt: "Recalculando e lendo a devnet…" })}</p>
                )}
                {denied && (
                  <p className="flex items-start gap-2 rounded-xl border border-border bg-card/40 p-3 text-sm text-muted-foreground">
                    <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
                    {tr({
                      en: "The record behind this proof stays private to your role. Its commitment can still be checked on Solana above.",
                      pt: "O registro por trás desta prova fica privado para o seu perfil. O compromisso dele ainda pode ser conferido na Solana, acima.",
                    })}
                  </p>
                )}
                {record.error && !denied && <p className="text-sm text-alert">{describeError(record.error)}</p>}
                {record.data && <ProofResult result={record.data} compact />}
                {record.data && (
                  <Link to={`/app/audit/${p.kind}/${p.entity_id}`} onClick={onClose} className="inline-flex items-center gap-1 text-sm text-info hover:underline">
                    {tr({ en: "Open the full audit page", pt: "Abrir a página completa de auditoria" })} <ArrowUpRight size={13} aria-hidden />
                  </Link>
                )}
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ProofDrawerProvider({ children }: { children: ReactNode }) {
  const [proof, setProof] = useState<ProofTarget | null>(null);
  return (
    <ProofDrawerContext.Provider value={setProof}>
      {children}
      <Drawer proof={proof} onClose={() => setProof(null)} />
    </ProofDrawerContext.Provider>
  );
}
