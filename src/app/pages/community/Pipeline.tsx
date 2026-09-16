import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import type { Tone } from "../../components/product/StatusPill";
import { DECISION_LABEL, LOAN_LABEL, OPPORTUNITY_LABEL, type LoanStatus } from "../../lib/credit";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import { useCommunity } from "./context";
import { useParticipants } from "./queries";

const LOAN_TONE: Record<LoanStatus, Tone> = {
  DRAFT: "neutral", PARTNER_APPROVED: "info", DISBURSED: "info", ACTIVE: "positive", PAID: "positive", DEFAULTED: "alert", CANCELLED: "neutral",
};
const FINANCED: LoanStatus[] = ["DISBURSED", "ACTIVE", "PAID", "DEFAULTED"];

/** Everyone who asked for capital, and where the request stands: eligible, a P2P opportunity, funded. The community sees status and totals, never investors. */
export default function Pipeline() {
  const { community } = useCommunity();
  const participants = useParticipants(community.id);

  if (participants.isError) return <LoadError error={participants.error} onRetry={() => participants.refetch()} />;
  if (!participants.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const rows = participants.data.filter((p) => p.intent_purpose || p.loan_status)
    .sort((a, b) => b.stage_no - a.stage_no || a.display_name.localeCompare(b.display_name));
  const asking = participants.data.filter((p) => p.intent_purpose);
  const eligible = asking.filter((p) => p.eligibility_decision === "ELIGIBLE" || p.eligibility_decision === "ELIGIBLE_REDUCED");
  const listed = participants.data.filter((p) => p.stage_no >= 6);
  const funded = participants.data.filter((p) => p.stage_no >= 7);
  const financed = participants.data.filter((p) => p.loan_status && FINANCED.includes(p.loan_status));
  const late = participants.data.filter((p) => p.late);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Asking for credit" value={asking.length} hint={money(asking.reduce((n, p) => n + (p.intent_cents ?? 0), 0))} />
        <StatTile label="Eligible" value={eligible.length} hint="by EmpowerFI's rules" />
        <StatTile label="P2P opportunities" value={listed.length} hint={money(listed.reduce((n, p) => n + (p.opportunity_cents ?? 0), 0))} />
        <StatTile label="Funded" value={funded.length} hint={money(funded.reduce((n, p) => n + (p.funded_cents ?? 0), 0))} hintTone="positive" />
        <StatTile label="Disbursed" value={financed.length} hint="by Pix" hintTone="positive" />
        <StatTile label="Late" value={late.length} hint="instalments overdue" hintTone={late.length ? "alert" : "neutral"} />
      </div>

      <Panel title="P2P pipeline" description="Requests move from the community to EmpowerFI's eligibility rules, become P2P opportunities with a pool of capital, and are funded by investors — domestic or global. She receives and repays in reais, by Pix.">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nobody has asked for credit yet.</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Participant</th>
                  <th className="py-2 pr-4 font-medium">Purpose</th>
                  <th className="py-2 pr-4 text-right font-medium">Requested</th>
                  <th className="py-2 pr-4 font-medium">Eligibility</th>
                  <th className="py-2 pr-4 font-medium">P2P funding</th>
                  <th className="py-2 font-medium">Loan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.entrepreneur_id}>
                    <td className="py-3 pr-4">
                      <Link to={`../participants/${p.entrepreneur_id}`} relative="path" className="font-medium text-foreground hover:underline">{p.display_name}</Link>
                      {p.business_sector && <span className="block text-xs text-muted-foreground">{p.business_sector}</span>}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.intent_purpose ? PURPOSE_LABEL[p.intent_purpose] : "—"}</td>
                    <td className="num py-3 pr-4 text-right text-foreground">{money(p.intent_cents)}</td>
                    <td className="py-3 pr-4">
                      {p.eligibility_decision
                        ? <span className={`rounded-full border px-2 py-0.5 text-xs ${DECISION_LABEL[p.eligibility_decision].tone}`}>{DECISION_LABEL[p.eligibility_decision].title}</span>
                        : <span className="text-xs text-muted-foreground">Not evaluated</span>}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {p.stage_no >= 6 ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <PoolPill pool={p.funding_pool} />
                          <span className="num">{money(p.funded_cents ?? 0)} of {money(p.opportunity_cents)}</span>
                        </span>
                      ) : p.opportunity_status ? OPPORTUNITY_LABEL[p.opportunity_status] : "—"}
                    </td>
                    <td className="py-3">
                      {p.loan_status ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill tone={LOAN_TONE[p.loan_status]}>{LOAN_LABEL[p.loan_status]}</StatusPill>
                          {p.loan_term && FINANCED.includes(p.loan_status) && (
                            <span className="num text-xs text-muted-foreground">{p.instalments_paid}/{p.loan_term}</span>
                          )}
                          {p.late && <AlertTriangle size={14} className="text-alert" aria-label="Late" />}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
