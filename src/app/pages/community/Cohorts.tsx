import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import { REQUIREMENT_SHORT, STAGE_LABEL, STAGES } from "../../lib/community";
import { money, monthLabel, PURPOSE_LABEL } from "../../lib/readiness";
import type { CreditPurpose } from "../../lib/readiness";
import { useCommunity } from "./context";
import { useCohorts } from "./queries";

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

const BUCKETS = [
  { key: "le_30", label: "≤ 30 days", cls: "bg-positive" },
  { key: "d31_60", label: "31–60", cls: "bg-positive/60" },
  { key: "d61_90", label: "61–90", cls: "bg-info/60" },
  { key: "gt_90", label: "> 90", cls: "bg-caution/70" },
  { key: "not_yet", label: "Not yet", cls: "bg-secondary" },
] as const;

/** Intake-month cohorts: conversion, time to readiness, what holds people back, capital need, and what came of it. */
export default function Cohorts() {
  const { community } = useCommunity();
  const cohorts = useCohorts(community.id);

  if (cohorts.isError) return <LoadError error={cohorts.error} onRetry={() => cohorts.refetch()} />;
  if (!cohorts.data) return <div className="space-y-6"><Skeleton className="h-56 w-full" /><Skeleton className="h-56 w-full" /></div>;
  const list = cohorts.data;
  if (list.length === 0) return <p className="text-sm text-muted-foreground">No participants yet, so no cohorts.</p>;

  // What holds people back, across cohorts.
  const reasons = new Map<string, number>();
  for (const c of list) for (const [code, n] of Object.entries(c.not_ready_reasons)) reasons.set(code, (reasons.get(code) ?? 0) + n);
  const reasonList = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const topReason = Math.max(1, ...reasonList.map(([, n]) => n));

  const purposes = new Map<CreditPurpose, { n: number; cents: number }>();
  for (const c of list) {
    for (const [p, v] of Object.entries(c.need_by_purpose) as [CreditPurpose, { n: number; cents: number }][]) {
      const cur = purposes.get(p) ?? { n: 0, cents: 0 };
      purposes.set(p, { n: cur.n + v.n, cents: cur.cents + v.cents });
    }
  }
  const purposeList = [...purposes.entries()].sort((a, b) => b[1].cents - a[1].cents);
  const topPurpose = Math.max(1, ...purposeList.map(([, v]) => v.cents));

  return (
    <div className="space-y-6">
      <Panel title="Conversion by cohort" description="Each intake month, and how far its participants have come. Percentages are of those who joined.">
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Intake</th>
                {STAGES.map((s) => <th key={s} className="py-2 pr-3 text-right font-medium">{STAGE_LABEL[s]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((c) => (
                <tr key={c.intake}>
                  <td className="py-2.5 pr-4 font-medium text-foreground">{monthLabel(c.intake)}</td>
                  {STAGES.map((s) => (
                    <td key={s} className="num py-2.5 pr-3 text-right">
                      <span className="text-foreground">{c.funnel[s]}</span>
                      {s !== "joined" && <span className="ml-1 text-xs text-muted-foreground">{pct(c.funnel[s], c.funnel.joined)}%</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Time to readiness" description="Days from joining to the first CREDIT_READY, per cohort. Recent cohorts have had less time.">
          <div className="space-y-3">
            {list.map((c) => {
              const d = c.days_to_ready;
              return (
                <div key={c.intake} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground">{monthLabel(c.intake)}</span>
                    <span className="text-muted-foreground">{d.median !== null ? `median ${Math.round(d.median)} days` : "none ready yet"}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-secondary/50" role="img"
                    aria-label={BUCKETS.map((b) => `${b.label}: ${d[b.key]}`).join(", ")}>
                    {BUCKETS.map((b) => d[b.key] > 0 && (
                      <div key={b.key} className={b.cls} style={{ width: `${pct(d[b.key], c.participants)}%` }} />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
              {BUCKETS.map((b) => <span key={b.key} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${b.cls}`} />{b.label}</span>)}
            </div>
          </div>
        </Panel>

        <Panel title="What holds people back" description="Missing requirements of those not yet ready, across cohorts.">
          {reasonList.length === 0 ? <p className="text-sm text-muted-foreground">Nothing missing: everyone assessed is ready or in review.</p> : (
            <ul className="space-y-2">
              {reasonList.map(([code, n]) => (
                <li key={code} className="grid grid-cols-[1fr_2.5rem] items-center gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-foreground">{REQUIREMENT_SHORT[code] ?? code}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-caution" style={{ width: `${(n / topReason) * 100}%` }} />
                    </div>
                  </div>
                  <span className="num text-right text-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            In manual review: {list.reduce((n, c) => n + c.manual_review, 0)}. Someone looks before the rules decide.
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Credit need by productive purpose" description="Active requests from participants who asked, by what the capital is for.">
          {purposeList.length === 0 ? <p className="text-sm text-muted-foreground">No credit requests yet.</p> : (
            <ul className="space-y-2">
              {purposeList.map(([p, v]) => (
                <li key={p} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-foreground">{PURPOSE_LABEL[p]} <span className="text-xs text-muted-foreground">· {v.n}</span></span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${(v.cents / topPurpose) * 100}%` }} />
                    </div>
                  </div>
                  <span className="num text-right text-foreground">{money(v.cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Operations and outcomes" description="What partners did with the cohort's opportunities, and what the capital did after.">
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Intake</th>
                  <th className="py-2 pr-3 text-right font-medium">Referred</th>
                  <th className="py-2 pr-3 text-right font-medium">Approved</th>
                  <th className="py-2 pr-3 text-right font-medium">Disbursed</th>
                  <th className="py-2 pr-3 text-right font-medium">Sales up</th>
                  <th className="py-2 text-right font-medium">EVC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((c) => (
                  <tr key={c.intake}>
                    <td className="py-2 pr-3 text-foreground">{monthLabel(c.intake)}</td>
                    <td className="num py-2 pr-3 text-right">{c.operations.referred}</td>
                    <td className="num py-2 pr-3 text-right">{c.operations.approved}</td>
                    <td className="num py-2 pr-3 text-right">{c.operations.disbursed}</td>
                    <td className="num py-2 pr-3 text-right">{c.outcomes.measured ? `${c.outcomes.revenue_up}/${c.outcomes.measured}` : "—"}</td>
                    <td className={`num py-2 text-right ${c.outcomes.evc_cents < 0 ? "text-alert" : "text-foreground"}`}>
                      {c.outcomes.measured ? money(c.outcomes.evc_cents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            EVC: economic value created, the incremental profit after the cost of credit, as measured. Simulated in this demo.
          </p>
        </Panel>
      </div>
    </div>
  );
}
