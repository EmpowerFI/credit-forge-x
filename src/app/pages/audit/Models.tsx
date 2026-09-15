import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { ELIGIBILITY_MODEL_VERSION, RULES as ELIGIBILITY_RULES } from "@empowerfi/eligibility-engine";
import { READINESS_MODEL_VERSION, RULES as READINESS_RULES } from "@empowerfi/readiness-engine";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { shortDate } from "../../lib/community";
import { describeError } from "../../lib/errors";
import { type ModelVersion, useModels } from "./queries";
import { rerun } from "./rerun";

function Versions({ rows, current }: { rows: ModelVersion[]; current?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Not run yet.</p>;
  return (
    <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-medium">Version</th>
            <th className="py-2 pr-4 text-right font-medium">Runs</th>
            <th className="py-2 pr-4 font-medium">Concluded</th>
            <th className="py-2 pr-4 text-right font-medium">On chain</th>
            <th className="py-2 font-medium">In use</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((v) => (
            <tr key={v.version}>
              <td className="py-2.5 pr-4">
                <span className="font-mono text-xs text-foreground">{v.version}</span>
                {current && <span className="ml-2">{v.version === current ? <StatusPill tone="positive">this build</StatusPill> : <StatusPill tone="neutral">earlier</StatusPill>}</span>}
              </td>
              <td className="num py-2.5 pr-4 text-right text-foreground">{v.runs}</td>
              <td className="py-2.5 pr-4">
                <span className="flex flex-wrap gap-1.5">
                  {Object.entries(v.outcomes ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <span key={k} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {k.toLowerCase().replace(/_/g, " ")} · <span className="num">{n}</span>
                    </span>
                  ))}
                </span>
              </td>
              <td className="num py-2.5 pr-4 text-right text-muted-foreground">{v.anchored}/{v.runs}</td>
              <td className="py-2.5 text-xs text-muted-foreground">{shortDate(v.first_at)} – {shortDate(v.last_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Parameters({ rules }: { rules: Record<string, unknown> }) {
  return (
    <details className="group rounded-lg border border-border px-4 py-2.5">
      <summary className="cursor-pointer text-sm text-muted-foreground group-open:text-foreground">Parameters of this version</summary>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {Object.entries(rules).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1">
            <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
            <dd className="num font-mono text-xs text-foreground">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** The engines behind every decision: which versions ran, what they concluded, and whether they still reproduce. */
export default function Models() {
  const models = useModels();
  const check = useMutation({ mutationFn: rerun });

  if (models.isError) return <LoadError error={models.error} onRetry={() => models.refetch()} />;
  if (!models.data) return <div className="space-y-6"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;
  const m = models.data;
  const passed = check.data?.filter((r) => r.ok).length ?? 0;

  return (
    <div className="space-y-6">
      <Panel title="Reproduce the latest decisions"
        description="Rules, not a black box: the same inputs always give the same result. This re-runs the twelve latest readiness and eligibility assessments through the engines bundled in this page, and compares every stored field."
        actions={
          <Button onClick={() => check.mutate()} disabled={check.isPending} className="gap-2">
            {check.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Re-run in my browser
          </Button>
        }>
        {check.isError && <p className="text-sm text-alert">{describeError(check.error)}</p>}
        {check.data && (
          <div className="space-y-3">
            <p className={`flex items-center gap-2 text-sm font-medium ${passed === check.data.length ? "text-positive" : "text-alert"}`}>
              {passed === check.data.length ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {passed} of {check.data.length} reproduce exactly.
            </p>
            <ul className="flex flex-wrap gap-2">
              {check.data.map((r) => (
                <li key={r.id}>
                  <Link to={`/app/audit/${r.kind}/${r.id}`} title={`${r.kind} · ${r.version}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${r.ok ? "tone-positive" : "tone-alert"}`}>
                    {r.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {r.kind}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel title="Readiness engine" description="Is the business prepared for a credit conversation? Education, reporting, data quality and the business itself.">
        <Versions rows={m.readiness} current={READINESS_MODEL_VERSION} />
        <Parameters rules={READINESS_RULES} />
      </Panel>

      <Panel title="Eligibility engine" description="Only for those ready and asking: an amount and a term the business can carry. The partner decides.">
        <Versions rows={m.eligibility} current={ELIGIBILITY_MODEL_VERSION} />
        <Parameters rules={ELIGIBILITY_RULES} />
      </Panel>

      <Panel title="Productive outcome" description="After a loan: did sales change, was the capital used as declared, what value did it create?">
        <Versions rows={m.outcome} />
      </Panel>
    </div>
  );
}
