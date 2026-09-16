import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import { platform } from "../../lib/platform";
import { money } from "../../lib/readiness";
import { useCommunity } from "./context";
import { useCohorts, useOverview } from "./queries";

interface CostToServe {
  participants: number;
  ready: number;
  loans: number;
  disbursed_cents: number;
  total_cents: number;
  staff_minutes: number;
  by_phase: { preparation: number; origination: number; servicing: number };
  by_stage: Record<string, number>;
  per_participant_cents: number | null;
  per_ready_cents: number | null;
  per_loan_cents: number | null;
  per_100_disbursed_cents: number | null;
  automated_share_bps: number | null;
}

/**
 * What the community's work cost and what the capital did after. Cost is
 * counted from the first day, preparation included: the part a conventional
 * lender never sees. Outcomes are measured after disbursement, never promised.
 */
const bpsPctOf = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export default function Impact() {
  const { community } = useCommunity();
  const cohorts = useCohorts(community.id);
  const overview = useOverview(community.id);
  const cts = useQuery({
    queryKey: ["platform", "ci-cts", community.id],
    queryFn: async () => {
      const { data, error } = await platform.rpc("cts_summary", { p_community_id: community.id });
      if (error) throw error;
      return data as unknown as CostToServe;
    },
  });

  if (cts.isError) return <LoadError error={cts.error} onRetry={() => cts.refetch()} />;
  if (cohorts.isError) return <LoadError error={cohorts.error} onRetry={() => cohorts.refetch()} />;
  if (overview.isError) return <LoadError error={overview.error} onRetry={() => overview.refetch()} />;
  if (!cts.data || !cohorts.data || !overview.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const c = cts.data;
  const o = cohorts.data.reduce(
    (a, x) => ({
      measured: a.measured + x.outcomes.measured, revenue_up: a.revenue_up + x.outcomes.revenue_up,
      as_declared: a.as_declared + x.outcomes.as_declared, evc_cents: a.evc_cents + x.outcomes.evc_cents,
      evc_positive: a.evc_positive + x.outcomes.evc_positive, withheld: a.withheld + (x.outcomes.withheld ?? 0),
    }),
    { measured: 0, revenue_up: 0, as_declared: 0, evc_cents: 0, evc_positive: 0, withheld: 0 },
  );
  const phaseTotal = Math.max(1, c.by_phase.preparation + c.by_phase.origination + c.by_phase.servicing);
  const outreach = c.by_stage?.outreach ?? 0;
  const k = overview.data.capital;

  return (
    <div className="space-y-6">
      <Panel title="From financed capital to repayment" description="What investors' P2P capital funded in this community, what has come back, and how the loans are doing. Totals only; simulated in this demo.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Financed" value={money(k.financed_cents)} hint={`${bpsPctOf(k.domestic_cents, k.funded_cents)} domestic · ${bpsPctOf(k.global_cents, k.funded_cents)} global`} />
          <StatTile label="Repaid" value={money(k.repaid_cents)} hint={k.financed_cents ? `${Math.round((k.repaid_cents / k.financed_cents) * 100)}% of financed` : undefined} hintTone="positive" />
          <StatTile label="Instalments on time" value={k.instalments_due ? `${Math.min(k.instalments_paid, k.instalments_due)}/${k.instalments_due}` : "—"} hint="paid of those due" />
          <StatTile label="Loans" value={k.loans_repaying + k.loans_late + k.loans_paid + k.loans_defaulted}
            hint={`${k.loans_paid} paid off · ${k.loans_late} late · ${k.loans_defaulted} defaulted`} hintTone={k.loans_late + k.loans_defaulted ? "caution" : "positive"} />
        </div>
        <p className="text-xs text-muted-foreground">
          Financed capital leads to repayment, and repayment to the outcomes below: what changed in the businesses after the loan.
        </p>
      </Panel>

      <Panel title="Productive outcomes" description="Measured after disbursement: did sales change, was the capital used as declared, what value did it create? Simulated in this demo.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Loans measured" value={o.measured} />
          <StatTile label="Sales up" value={o.measured ? `${o.revenue_up}/${o.measured}` : "—"} hintTone="positive" />
          <StatTile label="Capital as declared" value={o.measured ? `${o.as_declared}/${o.measured}` : "—"} />
          <StatTile label="Economic value created" value={o.measured ? money(o.evc_cents) : "—"}
            hint={o.measured ? `${o.evc_positive} of ${o.measured} positive` : undefined} hintTone={o.evc_cents < 0 ? "alert" : "positive"} />
        </div>
        <p className="text-xs text-muted-foreground">
          EVC is the incremental profit after the cost of credit. Negative values are shown as they are: good credit is not only
          credit that gets repaid, and not every loan creates value.
        </p>
        {o.withheld > 0 && (
          <p className="text-xs text-muted-foreground">
            {o.withheld} measured outcome{o.withheld === 1 ? " is" : "s are"} left out of these totals: {o.withheld === 1 ? "its owner" : "their owners"} chose
            not to be counted in impact figures.
          </p>
        )}
      </Panel>

      <Panel title="Cost to serve" description="Counted stage by stage from the community's first day, and borne by EmpowerFI and the community.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Total" value={money(c.total_cents)} hint={`${Math.round(c.staff_minutes / 60)} staff hours`} />
          <StatTile label="Per participant" value={money(c.per_participant_cents)} />
          <StatTile label="Per ready participant" value={money(c.per_ready_cents)} />
          <StatTile label="Per loan" value={money(c.per_loan_cents)} />
          <StatTile label="Per R$ 100 lent" value={money(c.per_100_disbursed_cents)} />
          <StatTile label="Community outreach" value={money(outreach)} hint="logged contacts" />
        </div>
        <div className="space-y-1.5">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary" role="img"
            aria-label={`Preparation ${money(c.by_phase.preparation)}, origination ${money(c.by_phase.origination)}, servicing ${money(c.by_phase.servicing)}`}>
            <div className="bg-accent" style={{ width: `${(c.by_phase.preparation / phaseTotal) * 100}%` }} />
            <div className="bg-primary" style={{ width: `${(c.by_phase.origination / phaseTotal) * 100}%` }} />
            <div className="bg-positive" style={{ width: `${(c.by_phase.servicing / phaseTotal) * 100}%` }} />
          </div>
          <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            <span><span className="text-accent">■</span> Preparation {money(c.by_phase.preparation)}</span>
            <span><span className="text-primary">■</span> Origination {money(c.by_phase.origination)}</span>
            <span><span className="text-positive">■</span> Servicing {money(c.by_phase.servicing)}</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Rates are pilot assumptions (staff time at R$ 30/h), which the pilot exists to replace with measured costs.
        </p>
      </Panel>
    </div>
  );
}
