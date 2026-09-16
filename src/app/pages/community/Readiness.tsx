import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import { READINESS_TONE, requirementForLeader, REQUIREMENT_SHORT } from "../../lib/community";
import { REASON_LABEL, STATUS_LABEL, type ReadinessStatus } from "../../lib/readiness";
import { useCommunity } from "./context";
import { useParticipants } from "./queries";

const STATUSES = Object.keys(STATUS_LABEL) as ReadinessStatus[];

/** The readiness engine's view of the community: who is where, why, and who is one step away. */
export default function Readiness() {
  const { community } = useCommunity();
  const participants = useParticipants(community.id);

  if (participants.isError) return <LoadError error={participants.error} onRetry={() => participants.refetch()} />;
  if (!participants.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const rows = participants.data;

  const byStatus = new Map<ReadinessStatus | "none", number>();
  for (const p of rows) byStatus.set(p.readiness_status ?? "none", (byStatus.get(p.readiness_status ?? "none") ?? 0) + 1);

  const notReady = rows.filter((p) => p.readiness_status === "NEEDS_MORE_DATA" || p.readiness_status === "NEEDS_PREPARATION");
  const missing = new Map<string, number>();
  for (const p of notReady) for (const m of p.missing_requirements) missing.set(m.code, (missing.get(m.code) ?? 0) + 1);
  const missingList = [...missing.entries()].sort((a, b) => b[1] - a[1]);
  const topMissing = Math.max(1, ...missingList.map(([, n]) => n));

  const reasons = new Map<string, number>();
  for (const p of rows) for (const r of p.readiness_reasons) reasons.set(r, (reasons.get(r) ?? 0) + 1);
  const reasonList = [...reasons.entries()].sort((a, b) => b[1] - a[1]);

  // One requirement from ready: where the community's help goes furthest.
  const closest = notReady.filter((p) => p.missing_requirements.length === 1)
    .sort((a, b) => (b.readiness_score ?? 0) - (a.readiness_score ?? 0));
  const readyNotAsking = rows.filter((p) => p.readiness_status === "CREDIT_READY" && !p.intent_purpose);

  const bands = [
    { label: "80–100", n: rows.filter((p) => (p.readiness_score ?? -1) >= 80).length },
    { label: "60–79", n: rows.filter((p) => (p.readiness_score ?? -1) >= 60 && (p.readiness_score ?? -1) < 80).length },
    { label: "40–59", n: rows.filter((p) => (p.readiness_score ?? -1) >= 40 && (p.readiness_score ?? -1) < 60).length },
    { label: "0–39", n: rows.filter((p) => p.readiness_score !== null && p.readiness_score < 40).length },
  ];
  const topBand = Math.max(1, ...bands.map((b) => b.n));

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <DataTag kind="derived" /> Derived by the readiness engine from education, reporting and data quality. Readiness is not a
        credit decision: eligibility and P2P funding come later.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {STATUSES.map((s) => (
          <Link key={s} to={`../participants?readiness=${s}`} relative="path" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <StatTile label={STATUS_LABEL[s].title} value={byStatus.get(s) ?? 0} hintTone={READINESS_TONE[s]}
              hint={`${rows.length ? Math.round(((byStatus.get(s) ?? 0) / rows.length) * 100) : 0}%`} />
          </Link>
        ))}
        <Link to="../participants?readiness=none" relative="path" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatTile label="Not assessed yet" value={byStatus.get("none") ?? 0} hint="no check-in yet" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="What is missing" description="Requirements not yet met, among those who need more data or preparation.">
          {missingList.length === 0 ? <p className="text-sm text-muted-foreground">Nothing missing.</p> : (
            <ul className="space-y-2">
              {missingList.map(([code, n]) => (
                <li key={code} className="grid grid-cols-[1fr_2.5rem] items-center gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-foreground">{REQUIREMENT_SHORT[code] ?? code}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-caution" style={{ width: `${(n / topMissing) * 100}%` }} />
                    </div>
                  </div>
                  <span className="num text-right text-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Score distribution" description="The readiness score, 0–100: preparation, regularity, data quality and the business.">
          <ul className="space-y-2">
            {bands.map((b) => (
              <li key={b.label} className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="num text-muted-foreground">{b.label}</span>
                <div className="h-5 overflow-hidden rounded-md bg-secondary/50">
                  <div className="h-full rounded-md bg-info/50" style={{ width: `${(b.n / topBand) * 100}%` }} />
                </div>
                <span className="num text-right text-foreground">{b.n}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="One step from ready" description="A single requirement stands between them and CREDIT_READY: where the community's help goes furthest.">
          {closest.length === 0 ? <p className="text-sm text-muted-foreground">Nobody is one requirement away right now.</p> : (
            <ul className="divide-y divide-border text-sm">
              {closest.map((p) => (
                <li key={p.entrepreneur_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link to={`../participants/${p.entrepreneur_id}`} relative="path" className="font-medium text-foreground hover:underline">{p.display_name}</Link>
                  <span className="text-xs text-muted-foreground">{requirementForLeader(p.missing_requirements[0])}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="What the engine sees" description="Reason codes behind the latest assessments.">
          <div className="flex flex-wrap gap-2">
            {reasonList.map(([r, n]) => (
              <span key={r} className={`rounded-full border px-2.5 py-1 text-xs ${REASON_LABEL[r]?.positive === false ? "tone-caution" : "tone-positive"}`}>
                {REASON_LABEL[r]?.text ?? r} · <span className="num">{n}</span>
              </span>
            ))}
            {reasonList.length === 0 && <p className="text-sm text-muted-foreground">No assessments yet.</p>}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{readyNotAsking.length}</span> ready and not asking for credit. That is a
            complete outcome, not a gap to close.
          </p>
        </Panel>
      </div>
    </div>
  );
}
