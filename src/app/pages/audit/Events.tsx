import { Link, useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import { ACTOR_LABEL, EVENT_LABEL } from "../../lib/audit";
import { useEvents } from "./queries";

const ALL = "all";
// Enum values read as words; codes and versions stay as they are.
const pretty = (label: string) =>
  label.split(" · ").map((part) => (/^[A-Za-z_]+$/.test(part) ? part.toLowerCase().replace(/_/g, " ") : part)).join(" · ");
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** What happened on the platform, newest first: who caused it, by role, and the proof it left. */
export default function Events() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind");
  const events = useEvents(kind);

  const setKind = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === ALL) next.delete("kind");
    else next.set("kind", v);
    setParams(next, { replace: true });
  };

  if (events.isError) return <LoadError error={events.error} onRetry={() => events.refetch()} />;

  return (
    <Panel title="Event log"
      description="The latest 200 facts, from every table that records one. Actors appear by role; participants by code. What a fact contains stays behind its proof."
      actions={
        <Select value={kind ?? ALL} onValueChange={setKind}>
          <SelectTrigger className="w-[14rem]" aria-label="Kind of event"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Every event</SelectItem>
            {Object.entries(EVENT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      }>
      {!events.data ? <Skeleton className="h-96 w-full" /> : (
        <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="py-2 pr-4 font-medium">Who</th>
                <th className="py-2 pr-4 font-medium">Subject</th>
                <th className="py-2 font-medium">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.data.map((e, i) => (
                <tr key={`${e.kind}-${e.at}-${i}`}>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-muted-foreground">{when(e.at)}</td>
                  <td className="py-2.5 pr-4">
                    <span className="block text-foreground">{EVENT_LABEL[e.kind] ?? e.kind}</span>
                    {e.label && <span className="text-xs text-muted-foreground">{pretty(e.label)}</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{ACTOR_LABEL[e.actor] ?? e.actor}</td>
                  <td className="py-2.5 pr-4 text-xs">
                    {e.participant && <span className="font-mono text-foreground">{e.participant}</span>}
                    {e.community && <span className="block text-muted-foreground">{e.community}</span>}
                    {!e.participant && !e.community && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2.5 text-xs">
                    {!e.proof ? <span className="text-muted-foreground">Not a proven fact</span>
                      : e.proof.status !== "confirmed" ? <span className="text-caution">Proof {e.proof.status}</span>
                      : (
                        <span className="flex flex-wrap items-center gap-2">
                          <DataTag kind="proven" />
                          {e.proof.signature && <ExplorerLink tx={e.proof.signature} />}
                          <Link to={`/app/audit/${e.proof.kind}/${e.proof.entity_id}`} className="text-info hover:underline">Verify</Link>
                        </span>
                      )}
                  </td>
                </tr>
              ))}
              {events.data.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Nothing recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
