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
import { PROOF_KIND_LABEL } from "../../lib/audit";
import type { AnchorKind } from "../../lib/platform";
import { type Attestation, type AttestationState, useAttestations } from "./queries";

const ALL = "all";
const SIZE = 25;

const STATES: { key: AttestationState; label: string; tone: Tone; hint: string }[] = [
  { key: "verified", label: "Verified", tone: "positive", hint: "on chain, re-checked by reconciliation" },
  { key: "unchecked", label: "Not yet re-checked", tone: "info", hint: "on chain, awaiting reconciliation" },
  { key: "queued", label: "Queued", tone: "caution", hint: "on their way to Solana" },
  { key: "failed", label: "Failed", tone: "alert", hint: "the chain refused them" },
  { key: "flagged", label: "Flagged", tone: "alert", hint: "missing on chain, or changed since" },
];

function state(a: Attestation): { label: string; tone: Tone } {
  if (a.reconcile === "missing" || a.reconcile === "mismatch") return { label: a.reconcile === "missing" ? "Missing" : "Mismatch", tone: "alert" };
  if (a.status === "failed") return { label: "Failed", tone: "alert" };
  if (a.status !== "confirmed") return { label: a.attempts > 1 ? `Retrying (${a.attempts})` : "Queued", tone: "caution" };
  return a.reconcile === "verified" ? { label: "Verified", tone: "positive" } : { label: "On chain", tone: "info" };
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

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

      <Panel title={`${d.total} proof${d.total === 1 ? "" : "s"}`}
        description="Each is a SHA-256 commitment to a record in the database. Verify recomputes it in your browser from the record and compares it with the account on Solana."
        actions={
          <Select value={kind ?? ALL} onValueChange={(v) => set("kind", v)}>
            <SelectTrigger className="w-[14rem]" aria-label="Kind of proof"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Every kind</SelectItem>
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
                <th className="py-2 pr-4 font-medium">Proof</th>
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">Commitment</th>
                <th className="py-2 pr-4 font-medium">Transaction</th>
                <th className="py-2 pr-4 font-medium">Anchored</th>
                <th className="py-2 font-medium"><span className="sr-only">Verify</span></th>
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
                        <Link to={`/app/audit/${a.kind}/${a.entity_id}`} className="text-xs font-medium text-info hover:underline">Verify</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {d.rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No proof matches.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => set("page", String(page - 1))} aria-label="Previous page">
              <ChevronLeft size={14} />
            </Button>
            <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => set("page", String(page + 1))} aria-label="Next page">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
