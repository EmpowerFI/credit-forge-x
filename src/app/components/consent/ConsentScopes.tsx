import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { DataTag } from "../product/DataLegend";
import ExplorerLink from "../product/ExplorerLink";
import StatusPill from "../product/StatusPill";
import { CHANNEL_LABEL, type Choices, type ConsentRecord, SCOPE_TEXT, SCOPES, setScope } from "../../lib/consent";
import { shortDate } from "../../lib/community";

/** The four uses of her data, each with what it reads, who sees it, and what never leaves. */
export function ConsentScopes({ value, onChange, disabled = false }: {
  value: Choices;
  onChange: (next: Choices) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {SCOPES.map((scope) => {
        const t = SCOPE_TEXT[scope];
        const on = value[scope];
        const id = `consent-${scope}`;
        return (
          <li key={scope} className={`rounded-xl border p-4 transition-colors ${on ? "border-positive/40 bg-positive/5" : "border-border"}`}>
            <div className="flex items-start justify-between gap-4">
              <label htmlFor={id} className="cursor-pointer space-y-0.5">
                <span className="block font-medium text-foreground">{t.title}</span>
                {t.needs && <span className="block text-xs text-muted-foreground">Builds on “{SCOPE_TEXT[t.needs].title.toLowerCase()}”.</span>}
              </label>
              <Switch id={id} checked={on} disabled={disabled} onCheckedChange={(v) => onChange(setScope(value, scope, v))} />
            </div>
            <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
              <dt className="text-xs text-muted-foreground">Uses</dt>
              <dd className="text-foreground">{t.uses}</dd>
              <dt className="text-xs text-muted-foreground">Who sees it</dt>
              <dd className="text-foreground">{t.who}</dd>
              <dt className="text-xs text-muted-foreground">Never</dt>
              <dd className="flex items-start gap-1.5 text-foreground"><span className="mt-0.5"><DataTag kind="private" /></span>{t.never}</dd>
              {!on && (
                <>
                  <dt className="text-xs text-muted-foreground">Without it</dt>
                  <dd className="text-muted-foreground">{t.without}</dd>
                </>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/** One consent record at a glance: each use allowed or not, how and when it was given, and its proof. */
export function ConsentSummary({ record, compact = false }: { record: ConsentRecord | null; compact?: boolean }) {
  if (!record) {
    return <p className="text-sm text-muted-foreground">No consent recorded yet: nothing of hers is assessed or shared.</p>;
  }
  return (
    <div className="space-y-3">
      <ul className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {SCOPES.map((s) => (
          <li key={s} className="flex items-center gap-2 text-sm">
            {record[s]
              ? <Check size={15} className="shrink-0 text-positive" aria-label="Allowed" />
              : <X size={15} className="shrink-0 text-muted-foreground" aria-label="Not allowed" />}
            <span className={record[s] ? "text-foreground" : "text-muted-foreground"}>{SCOPE_TEXT[s].title}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Record #{record.consent_no} · {CHANNEL_LABEL[record.channel]} · {shortDate(record.at)} · {record.text_version}</span>
        <ProofLine proof={record.proof} />
      </div>
    </div>
  );
}

export function ProofLine({ proof }: { proof: ConsentRecord["proof"] }) {
  if (!proof) return <StatusPill tone="neutral">Not queued</StatusPill>;
  if (proof.status !== "confirmed") return <StatusPill tone="caution">Proof {proof.status}</StatusPill>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <DataTag kind="proven" withLabel />
      {proof.signature && <ExplorerLink tx={proof.signature} />}
      <Link to={`/app/audit/${proof.kind}/${proof.entity_id}`} className="text-info hover:underline">Verify</Link>
    </span>
  );
}
