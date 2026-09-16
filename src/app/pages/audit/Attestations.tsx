import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill, { type Tone } from "../../components/product/StatusPill";
import { formatDateTime, localized, tr } from "../../i18n";
import { PROOF_KIND_LABEL } from "../../lib/audit";
import type { AnchorKind } from "../../lib/platform";
import { type Attestation, type AttestationState, useAttestations } from "./queries";

const ALL = "all";
const SIZE = 25;

const STATES: { key: AttestationState; label: string; tone: Tone; hint: string }[] = localized([
  {
    key: "verified", label: { en: "Verified", pt: "Verificadas" }, tone: "positive",
    hint: { en: "on chain, re-checked by reconciliation", pt: "na blockchain, conferidas de novo pela conciliação" },
  },
  {
    key: "unchecked", label: { en: "Not yet re-checked", pt: "Ainda não conferidas" }, tone: "info",
    hint: { en: "on chain, awaiting reconciliation", pt: "na blockchain, aguardando a conciliação" },
  },
  { key: "queued", label: { en: "Queued", pt: "Na fila" }, tone: "caution", hint: { en: "on their way to Solana", pt: "a caminho da Solana" } },
  { key: "failed", label: { en: "Failed", pt: "Falharam" }, tone: "alert", hint: { en: "the chain refused them", pt: "a blockchain as recusou" } },
  {
    key: "flagged", label: { en: "Flagged", pt: "Sinalizadas" }, tone: "alert",
    hint: { en: "missing on chain, or changed since", pt: "ausentes na blockchain, ou alteradas depois" },
  },
]);

function state(a: Attestation): { label: string; tone: Tone } {
  if (a.reconcile === "missing" || a.reconcile === "mismatch") {
    return { label: a.reconcile === "missing" ? tr({ en: "Missing", pt: "Ausente" }) : tr({ en: "Mismatch", pt: "Divergente" }), tone: "alert" };
  }
  if (a.status === "failed") return { label: tr({ en: "Failed", pt: "Falhou" }), tone: "alert" };
  if (a.status !== "confirmed") {
    return {
      label: a.attempts > 1 ? tr({ en: `Retrying (${a.attempts})`, pt: `Tentando de novo (${a.attempts})` }) : tr({ en: "Queued", pt: "Na fila" }),
      tone: "caution",
    };
  }
  return a.reconcile === "verified"
    ? { label: tr({ en: "Verified", pt: "Verificada" }), tone: "positive" }
    : { label: tr({ en: "On chain", pt: "Na blockchain" }), tone: "info" };
}

const when = (iso: string | null) => (iso ? formatDateTime(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

/** Every proof the platform wrote, with what it commits to and where to check it. */
export default function Attestations() {
  const [params, setParams] = useSearchParams();
  const kind = (params.get("kind") as AnchorKind | null) ?? null;
  const st = (params.get("state") as AttestationState | null) ?? null;
  const page = Number(params.get("page") ?? 0);
  const q = useAttestations(kind, st, page, SIZE);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === ALL) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></div>;
  const d = q.data;
  const pages = Math.max(1, Math.ceil(d.total / SIZE));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {STATES.map((s) => (
          <button key={s.key} type="button" onClick={() => set("state", st === s.key ? null : s.key)}
            className={`rounded-xl text-left [&>div]:h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${st === s.key ? "ring-2 ring-primary" : ""}`}
            aria-pressed={st === s.key}>
            <StatTile label={s.label} value={d.by_state[s.key] ?? 0} hint={s.hint} hintTone={s.tone} />
          </button>
        ))}
      </div>

      <Panel title={tr({ en: `${d.total} proof${d.total === 1 ? "" : "s"}`, pt: `${d.total} prova${d.total === 1 ? "" : "s"}` })}
        description={tr({
          en: "Each is a SHA-256 commitment to a record in the database. Verify recomputes it in your browser from the record and compares it with the account on Solana.",
          pt: "Cada uma é um compromisso SHA-256 com um registro do banco de dados. Verificar o recalcula no seu navegador a partir do registro e o compara com a conta na Solana.",
        })}
        actions={
          <Select value={kind ?? ALL} onValueChange={(v) => set("kind", v)}>
            <SelectTrigger className="w-[14rem]" aria-label={tr({ en: "Kind of proof", pt: "Tipo de prova" })}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tr({ en: "Every kind", pt: "Todos os tipos" })}</SelectItem>
              {(Object.keys(PROOF_KIND_LABEL) as AnchorKind[]).map((k) => (
                <SelectItem key={k} value={k}>{PROOF_KIND_LABEL[k]} · {d.by_kind[k] ?? 0}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }>
        <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{tr({ en: "Proof", pt: "Prova" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "State", pt: "Estado" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Model", pt: "Modelo" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Commitment", pt: "Compromisso" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Transaction", pt: "Transação" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Anchored", pt: "Registrada na Solana" })}</th>
                <th className="py-2 font-medium"><span className="sr-only">{tr({ en: "Verify", pt: "Verificar" })}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.rows.map((a) => {
                const s = state(a);
                return (
                  <tr key={a.id} className="align-middle">
                    <td className="py-2.5 pr-4">
                      <span className="block text-foreground">{PROOF_KIND_LABEL[a.kind]}</span>
                      <span className="font-mono text-xs text-muted-foreground">#{a.id}{a.participant ? ` · ${a.participant}` : ""}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span title={a.reconcile_note ?? a.last_error ?? undefined}><StatusPill tone={s.tone}>{s.label}</StatusPill></span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{a.model_version ?? "—"}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{a.commitment ? `${a.commitment.slice(0, 10)}…` : "—"}</td>
                    <td className="py-2.5 pr-4">{a.signature ? <ExplorerLink tx={a.signature} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{when(a.confirmed_at ?? a.created_at)}</td>
                    <td className="py-2.5 text-right">
                      {a.status === "confirmed" && (
                        <Link to={`/app/audit/${a.kind}/${a.entity_id}`} className="text-xs font-medium text-info hover:underline">{tr({ en: "Verify", pt: "Verificar" })}</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {d.rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{tr({ en: "No proof matches.", pt: "Nenhuma prova corresponde." })}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{tr({ en: `Page ${page + 1} of ${pages}`, pt: `Página ${page + 1} de ${pages}` })}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => set("page", String(page - 1))} aria-label={tr({ en: "Previous page", pt: "Página anterior" })}>
              <ChevronLeft size={14} />
            </Button>
            <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => set("page", String(page + 1))} aria-label={tr({ en: "Next page", pt: "Próxima página" })}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
