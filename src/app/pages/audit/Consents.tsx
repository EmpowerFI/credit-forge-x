import { Check, CheckCircle2, X, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProofLine } from "../../components/consent/ConsentScopes";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import { shortDate } from "../../lib/community";
import { CHANNEL_LABEL, SCOPE_TEXT, SCOPES } from "../../lib/consent";
import { useConsentAudit } from "./queries";

const CHECKS = [
  { key: "assessed_without_consent", label: "Readiness assessments made without consent to assess" },
  { key: "eligibility_without_consent", label: "Eligibility assessments made without consent to assess" },
  { key: "referred_without_consent", label: "Requests referred to a partner without consent to share" },
  { key: "listed_without_consent", label: "Opportunities open to investors without consent to be shown" },
] as const;

/** Consent as recorded, and whether the platform honoured it — each check against the consent in force at the time. */
export default function Consents() {
  const q = useConsentAudit();
  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const d = q.data;
  const clean = CHECKS.every((c) => d.checks[c.key] === 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Participants" value={d.enrolled} hint={`${d.with_record} with a record`} />
        <StatTile label="Without a record" value={d.without_record} hint="nothing of theirs is used" hintTone={d.without_record ? "caution" : "positive"} />
        <StatTile label="Records" value={d.records} hint={`${d.changes} changes of mind`} />
        <StatTile label="From the community" value={d.by_channel.community} hint={`${d.by_channel.app} in the app`} />
        <StatTile label="Proven on Solana" value={d.anchored} hint={`of ${d.records}`} hintTone={d.anchored === d.records ? "positive" : "info"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Enforced, not only recorded"
          description="Every assessment, referral and listing checked against the consent that was in force when it happened. Each should read zero.">
          <ul className="divide-y divide-border">
            {CHECKS.map((c) => {
              const n = d.checks[c.key];
              return (
                <li key={c.key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="text-foreground">{c.label}</span>
                  <span className={`flex items-center gap-1.5 font-medium ${n === 0 ? "text-positive" : "text-alert"}`}>
                    {n === 0 ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />} <span className="num">{n}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={`text-sm ${clean ? "text-positive" : "text-alert"}`}>
            {clean ? "Nothing happened to anyone's data that they had not allowed." : "Something happened without the consent it needed: see the counts above."}
          </p>
        </Panel>

        <Panel title="What participants allow" description="Their latest record, per use.">
          <ul className="space-y-3">
            {SCOPES.map((s) => {
              const n = d.by_scope[s];
              const pct = d.with_record ? Math.round((n / d.with_record) * 100) : 0;
              return (
                <li key={s} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{SCOPE_TEXT[s].title}</span>
                    <span className="num text-muted-foreground">{n} · {pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-positive" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Latest records" description="Participants by code. Each record is a commitment on Solana, so none can be rewritten after the fact.">
        <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Participant</th>
                <th className="py-2 pr-4 font-medium">Record</th>
                {SCOPES.map((s) => <th key={s} className="py-2 pr-3 text-center font-medium capitalize">{s}</th>)}
                <th className="py-2 pr-4 font-medium">How</th>
                <th className="py-2 font-medium">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.recent.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-xs text-foreground">{r.participant}</span>
                    {r.community && <span className="block text-xs text-muted-foreground">{r.community}</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">#{r.consent_no} · {shortDate(r.at)}</td>
                  {SCOPES.map((s) => (
                    <td key={s} className="py-2.5 pr-3 text-center">
                      {r[s] ? <Check size={15} className="inline text-positive" aria-label="Allowed" /> : <X size={15} className="inline text-muted-foreground" aria-label="Not allowed" />}
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{CHANNEL_LABEL[r.channel]}</td>
                  <td className="py-2.5 text-xs"><ProofLine proof={r.proof} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
