import { useQuery } from "@tanstack/react-query";
import { platform } from "../lib/platform";
import { money } from "../lib/readiness";
import LoadError from "./LoadError";

// A community's funnel and its cost to serve. Cost is counted from the
// community's first day, not from disbursement: preparing people who may
// never borrow is part of what small credit costs, and the part a
// conventional lender never sees.

interface Summary {
  participants: number;
  ready: number;
  opportunities: number;
  loans: number;
  disbursed_cents: number;
  total_cents: number;
  staff_minutes: number;
  by_phase: { preparation: number; origination: number; servicing: number };
  per_participant_cents: number | null;
  per_ready_cents: number | null;
  per_opportunity_cents: number | null;
  per_loan_cents: number | null;
  per_100_disbursed_cents: number | null;
  automated_share_bps: number | null;
}

export default function CommunityFunnel({ communityId, memberIds, coreModules }: {
  communityId: string;
  memberIds: string[];
  coreModules: { total: number; completedBy: (id: string) => number };
}) {
  const data = useQuery({
    queryKey: ["platform", "funnel", communityId, memberIds],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const [checkins, readiness, intents, opportunities, loans, cts, outcomes] = await Promise.all([
        platform.from("checkins").select("entrepreneur_id").in("entrepreneur_id", memberIds),
        platform.from("latest_readiness").select("entrepreneur_id, status").in("entrepreneur_id", memberIds),
        platform.from("credit_intents").select("entrepreneur_id").in("entrepreneur_id", memberIds),
        platform.from("qualified_credit_opportunities").select("entrepreneur_id, status").in("entrepreneur_id", memberIds),
        platform.from("loans").select("entrepreneur_id, status").in("entrepreneur_id", memberIds),
        platform.rpc("cts_summary", { p_community_id: communityId }),
        platform.from("productive_outcomes")
          .select("loan_id, outcome_no, avg_revenue_before_cents, avg_revenue_after_cents, evc_cents, capital_use")
          .in("entrepreneur_id", memberIds),
      ]);
      for (const r of [checkins, readiness, intents, opportunities, loans, cts, outcomes]) if (r.error) throw r.error;
      // The latest measurement of each loan.
      const latest = new Map<string, NonNullable<typeof outcomes.data>[number]>();
      for (const o of outcomes.data ?? []) if ((latest.get(o.loan_id)?.outcome_no ?? 0) < o.outcome_no) latest.set(o.loan_id, o);
      const measured = [...latest.values()];
      const people = (rows: { entrepreneur_id: string | null }[] | null) => new Set((rows ?? []).map((r) => r.entrepreneur_id)).size;
      return {
        reporting: people(checkins.data),
        ready: (readiness.data ?? []).filter((r) => r.status === "CREDIT_READY").length,
        asked: people(intents.data),
        opportunities: (opportunities.data ?? []).length,
        approved: (opportunities.data ?? []).filter((o) => o.status === "partner_approved").length,
        lending: (loans.data ?? []).filter((l) => ["DISBURSED", "ACTIVE", "PAID"].includes(l.status)).length,
        cts: cts.data as unknown as Summary,
        outcomes: {
          measured: measured.length,
          salesUp: measured.filter((o) => o.avg_revenue_after_cents > o.avg_revenue_before_cents).length,
          asDeclared: measured.filter((o) => o.capital_use === "as_declared").length,
          evc: measured.reduce((sum, o) => sum + o.evc_cents, 0),
        },
      };
    },
  });

  if (data.isError) return <LoadError compact error={data.error} onRetry={() => data.refetch()} />;
  if (!data.data) return null;
  const d = data.data;
  const educated = memberIds.filter((id) => coreModules.total > 0 && coreModules.completedBy(id) >= coreModules.total).length;
  const stages = [
    { label: "Members", n: memberIds.length },
    { label: "Education completed", n: educated },
    { label: "Reporting", n: d.reporting },
    { label: "Ready for credit", n: d.ready },
    { label: "Asked for credit", n: d.asked },
    { label: "Qualified opportunity", n: d.opportunities },
    { label: "Approved by a partner", n: d.approved },
    { label: "Loans under way", n: d.lending },
  ];
  const top = Math.max(1, memberIds.length);
  const c = d.cts;
  const phaseTotal = Math.max(1, c.by_phase.preparation + c.by_phase.origination + c.by_phase.servicing);

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl p-6 glass glow-border">
        <h2 className="font-heading text-lg font-bold text-foreground">Funnel</h2>
        <ul className="space-y-2">
          {stages.map((s) => (
            <li key={s.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium text-foreground">{s.n}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((s.n / top) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Being ready and not asking is a complete outcome: the gap between the fourth and fifth rows is nobody's failure.
        </p>
        {d.outcomes.measured > 0 && (
          <p className="border-t border-border pt-3 text-sm text-foreground">
            After the loan: {d.outcomes.measured} measured, sales up in {d.outcomes.salesUp}, capital used as declared in{" "}
            {d.outcomes.asDeclared}; EVC {money(d.outcomes.evc)}.{" "}
            <span className="text-muted-foreground">Observed from reported months, not caused by the loan.</span>
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl p-6 glass glow-border">
        <h2 className="font-heading text-lg font-bold text-foreground">Cost to serve</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <span><span className="block text-xs text-muted-foreground">Total</span>{money(c.total_cents)}</span>
          <span><span className="block text-xs text-muted-foreground">Per participant</span>{money(c.per_participant_cents)}</span>
          <span><span className="block text-xs text-muted-foreground">Per ready participant</span>{money(c.per_ready_cents)}</span>
          <span><span className="block text-xs text-muted-foreground">Per opportunity</span>{money(c.per_opportunity_cents)}</span>
          <span><span className="block text-xs text-muted-foreground">Per loan</span>{money(c.per_loan_cents)}</span>
          <span><span className="block text-xs text-muted-foreground">Per R$ 100 lent</span>{money(c.per_100_disbursed_cents)}</span>
        </div>
        <div className="space-y-1">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-border" aria-label="Cost by phase">
            <div className="bg-accent" style={{ width: `${(c.by_phase.preparation / phaseTotal) * 100}%` }} />
            <div className="bg-primary" style={{ width: `${(c.by_phase.origination / phaseTotal) * 100}%` }} />
            <div className="bg-emerald-600" style={{ width: `${(c.by_phase.servicing / phaseTotal) * 100}%` }} />
          </div>
          <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            <span>■ <span className="text-accent">Preparation</span> {money(c.by_phase.preparation)}</span>
            <span>■ <span className="text-primary">Origination</span> {money(c.by_phase.origination)}</span>
            <span>■ <span className="text-emerald-700">Servicing</span> {money(c.by_phase.servicing)}</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Counted from the community's first day, stage by stage. Rates are pilot assumptions (staff time at R$ 30/h), which
          the pilot exists to replace with measured costs.
        </p>
      </div>
    </section>
  );
}
