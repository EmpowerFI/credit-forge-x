import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { ACTION, bpsPct, type OutreachAction, STAGE_HINT, STAGE_LABEL } from "../../lib/community";
import { money, monthLabel } from "../../lib/readiness";
import { useCommunity } from "./context";
import OutreachDialog from "./OutreachDialog";
import { useOverview } from "./queries";

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

// The stages a community produces are gold; the ones others decide are slate.
const OWN_STAGE = new Set(["credit_ready", "eligible", "p2p_opportunity"]);

export default function CommunityOverview() {
  const { community, leads } = useCommunity();
  const overview = useOverview(community.id);
  const [dialog, setDialog] = useState<OutreachAction | null>(null);

  if (overview.isError) return <LoadError error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data;
  const h = o?.hero;
  const top = Math.max(1, o?.funnel[0]?.n ?? 1);
  const queue = o?.queue.filter((q) => q.pending + q.contacted > 0) ?? [];
  const open = queue.find((q) => q.action === dialog);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Where the community stands{o?.as_of_period ? <> as of <span className="text-foreground">{monthLabel(o.as_of_period)}</span>, the latest month reported</> : null}.
        {" "}The community produces preparation, data and qualified P2P demand; investors fund it, domestic or global.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {!o ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />) : (
          <>
            <StatTile label="Qualified capital demand" value={money(o.hero.qualified_demand_cents)} hint={`${o.hero.p2p_opportunity} P2P opportunities`} hintTone="info" />
            <StatTile label="Funded" value={money(o.capital.funded_cents)} hint={`${bpsPct(o.capital.domestic_coverage_bps + o.capital.global_coverage_bps)} of demand`} hintTone="positive" />
            <StatTile label="Funding gap" value={money(o.capital.gap_cents)} hint={o.capital.waiting_for_capital ? `${o.capital.waiting_for_capital} waiting for a pool` : "still raising"} hintTone={o.capital.gap_cents ? "caution" : "positive"} />
            <StatTile label="Coverage" value={`${bpsPct(o.capital.domestic_coverage_bps)} · ${bpsPct(o.capital.global_coverage_bps)}`} hint="domestic · global" />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {!h ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />) : (
          <>
            <StatTile label="Participants" value={h.participants}
              hint={h.joined_this_month ? `+${h.joined_this_month} this month` : undefined} hintTone="positive" />
            <StatTile label="Education complete" value={h.education_complete} hint={`${pct(h.education_complete, h.participants)}%`} />
            <StatTile label="Credit ready" value={h.credit_ready} hint={`${pct(h.credit_ready, h.participants)}%`} />
            <StatTile label="Credit intent" value={h.credit_intent} hint={`${pct(h.credit_intent, h.participants)}%`} />
            <StatTile label="Eligible" value={h.eligible} hint={`${pct(h.eligible, h.participants)}%`} />
            <StatTile label="Funded" value={h.funded} hint={`of ${h.p2p_opportunity} P2P opportunities`} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Readiness funnel" className="lg:col-span-3"
          description="Participants who reached at least each stage. Credit ready without asking is a complete outcome.">
          {!o ? <Skeleton className="h-64 w-full" /> : (
            <ul className="space-y-2.5">
              {o.funnel.map((f, i) => {
                const prev = i > 0 ? o.funnel[i - 1].n : f.n;
                return (
                  <li key={f.stage} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_5rem]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help truncate text-muted-foreground underline decoration-dotted underline-offset-4">
                          {STAGE_LABEL[f.stage]}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{STAGE_HINT[f.stage]}</TooltipContent>
                    </Tooltip>
                    <div className="h-6 overflow-hidden rounded-md bg-secondary/50">
                      <div className={`h-full rounded-md ${OWN_STAGE.has(f.stage) ? "bg-primary" : "bg-info/40"}`}
                        style={{ width: `${Math.max(f.n ? 2 : 0, (f.n / top) * 100)}%` }} />
                    </div>
                    <span className="num text-right">
                      <span className="font-semibold text-foreground">{f.n}</span>
                      {i > 0 && prev > 0 && <span className="ml-1.5 hidden text-xs text-muted-foreground sm:inline">{pct(f.n, prev)}%</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Cohort health" className="lg:col-span-2" description="How well the community is keeping its record.">
          {!o ? <Skeleton className="h-64 w-full" /> : (
            <dl className="divide-y divide-border text-sm">
              {[
                { label: "Check-in completion", value: bpsPct(o.health.checkin_completion_bps), tone: "text-positive",
                  hint: o.as_of_period ? `reported ${monthLabel(o.as_of_period)}` : "" },
                { label: "Data quality", value: bpsPct(o.health.data_quality_bps), tone: "text-info", hint: "consistency of what is reported" },
                { label: "Reporting regularity", value: bpsPct(o.health.regularity_bps), tone: "text-info", hint: "month after month" },
                { label: "Needs human follow-up", value: String(o.health.needs_human_followup), tone: "text-caution", hint: "manual review" },
                { label: "Avg. time to readiness", value: o.health.avg_days_to_ready !== null ? `${o.health.avg_days_to_ready} days` : "—",
                  tone: "text-foreground", hint: "from joining" },
                { label: "Credit alerts", value: String(o.health.credit_alerts), tone: o.health.credit_alerts ? "text-alert" : "text-foreground",
                  hint: "late or defaulted loans" },
              ].map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt>
                    <span className="text-foreground">{r.label}</span>
                    {r.hint && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
                  </dt>
                  <dd className={`num font-heading text-lg font-bold ${r.tone}`}>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>

      <Panel title="Action queue"
        description="Who needs the community's attention now. Log each contact after you make it: it moves the queue and counts in cost to serve."
        actions={<Link to="participants" className="inline-flex items-center gap-1 text-sm text-info hover:underline">All participants <ArrowRight size={14} /></Link>}>
        {!o ? <Skeleton className="h-40 w-full" /> : queue.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-positive"><Check size={16} /> Nobody is waiting on the community right now.</p>
        ) : (
          <ul className="divide-y divide-border">
            {queue.map((q) => (
              <li key={q.action} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">{q.pending} participant{q.pending === 1 ? "" : "s"}</span>
                    <span className="text-muted-foreground">{ACTION[q.action].queue}</span>
                    {q.contacted > 0 && <StatusPill tone="neutral">{q.contacted} contacted this week</StatusPill>}
                  </p>
                  {q.participants.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {q.participants.slice(0, 5).map((p) => p.display_name).join(", ")}
                      {q.participants.length > 5 && ` and ${q.participants.length - 5} more`}
                    </p>
                  )}
                </div>
                {leads && q.pending > 0 && (
                  <Button variant="secondary" size="sm" className="gap-2" onClick={() => setDialog(q.action)}>
                    <MessageCircle size={14} /> {ACTION[q.action].button}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {dialog && open && (
        <OutreachDialog communityId={community.id} action={dialog} people={open.participants}
          open={Boolean(dialog)} onOpenChange={(v) => !v && setDialog(null)} />
      )}
    </div>
  );
}
