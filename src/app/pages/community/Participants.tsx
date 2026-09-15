import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { useAuth } from "../../auth/useAuth";
import { ACTION, type OutreachAction, type ParticipantRow, READINESS_TONE, scorePct, STAGE_LABEL, STAGES } from "../../lib/community";
import { SCOPES } from "../../lib/consent";
import { describeError } from "../../lib/errors";
import { platform } from "../../lib/platform";
import { monthLabel, STATUS_LABEL } from "../../lib/readiness";
import { useCommunity } from "./context";
import ConsentDialog from "./ConsentDialog";
import OutreachDialog from "./OutreachDialog";
import { useParticipants } from "./queries";

const ALL = "all";

const SCOPE_SHORT = { assessment: "assessment", partner: "partner", investors: "investors", impact: "impact" } as const;

/** Her consent in a word: all four uses, none, or which ones she withheld. */
function ConsentCell({ consent }: { consent: ParticipantRow["consent"] }) {
  if (!consent) return <StatusPill tone="alert">None</StatusPill>;
  const withheld = SCOPES.filter((s) => !consent[s]);
  if (withheld.length === 0) return <StatusPill tone="positive">All four</StatusPill>;
  if (withheld.length === SCOPES.length) return <StatusPill tone="alert">None given</StatusPill>;
  return <span className="text-xs text-caution">Not {withheld.map((s) => SCOPE_SHORT[s]).join(", ")}</span>;
}

export default function Participants() {
  const { community, leads } = useCommunity();
  const { profile } = useAuth();
  const participants = useParticipants(community.id);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const stage = params.get("stage") ?? ALL;
  const readiness = params.get("readiness") ?? ALL;
  const action = params.get("action") ?? ALL;
  const [logFor, setLogFor] = useState<{ action: OutreachAction; people: { entrepreneur_id: string; display_name: string }[] } | null>(null);
  const [consentFor, setConsentFor] = useState<{ entrepreneur_id: string; display_name: string } | null>(null);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (participants.data ?? []).filter((p) =>
      (stage === ALL || p.stage === stage)
      && (readiness === ALL || (p.readiness_status ?? "none") === readiness)
      && (action === ALL || (action === "any" ? p.next_action && !p.contacted_at : p.next_action === action))
      && (!needle || `${p.display_name} ${p.business_name ?? ""} ${p.business_sector ?? ""}`.toLowerCase().includes(needle)));
  }, [participants.data, q, stage, readiness, action]);

  if (participants.isError) return <LoadError error={participants.error} onRetry={() => participants.refetch()} />;

  return (
    <div className="space-y-6">
      <Panel
        title={participants.data ? `${rows.length} of ${participants.data.length} participants` : "Participants"}
        description="Readiness, reporting and data quality, without anyone's accounts: amounts stay with the participant and the partner.">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business or sector"
              className="pl-9" aria-label="Search participants" />
          </div>
          <Select value={stage} onValueChange={(v) => setFilter("stage", v)}>
            <SelectTrigger className="w-[11rem]" aria-label="Stage"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Stage: all</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={readiness} onValueChange={(v) => setFilter("readiness", v)}>
            <SelectTrigger className="w-[12rem]" aria-label="Readiness"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Readiness: all</SelectItem>
              {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s].title}</SelectItem>
              ))}
              <SelectItem value="none">Not assessed yet</SelectItem>
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={(v) => setFilter("action", v)}>
            <SelectTrigger className="w-[13rem]" aria-label="Next action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Next action: all</SelectItem>
              <SelectItem value="any">Waiting on the community</SelectItem>
              {(Object.keys(ACTION) as OutreachAction[]).map((a) => <SelectItem key={a} value={a}>{ACTION[a].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Participant</th>
                <th className="py-2 pr-4 font-medium">Education</th>
                <th className="py-2 pr-4 font-medium">Reporting</th>
                <th className="py-2 pr-4 text-right font-medium">Data quality</th>
                <th className="py-2 pr-4 font-medium">Readiness</th>
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Consent</th>
                <th className="py-2 font-medium">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!participants.data && Array.from({ length: 6 }, (_, i) => (
                <tr key={i}><td colSpan={8} className="py-2"><Skeleton className="h-9 w-full" /></td></tr>
              ))}
              {rows.map((p) => {
                const edu = p.core_total ? Math.round((p.core_done / p.core_total) * 100) : 100;
                return (
                  <tr key={p.entrepreneur_id} className="align-middle hover:bg-secondary/30">
                    <td className="py-3 pr-4">
                      <Link to={p.entrepreneur_id} className="font-medium text-foreground hover:underline">{p.display_name}</Link>
                      <span className="block text-xs text-muted-foreground">
                        {[p.business_sector, `joined ${monthLabel(p.intake)}`].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                          <div className={`h-full ${edu === 100 ? "bg-positive" : "bg-info"}`} style={{ width: `${edu}%` }} />
                        </div>
                        <span className="num text-xs text-muted-foreground">{p.core_done}/{p.core_total}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`num text-xs ${p.reported_latest ? "text-positive" : "text-caution"}`}>
                        {p.last_period ? monthLabel(p.last_period) : "never"}
                      </span>
                      <span className="block text-xs text-muted-foreground">{p.checkins} month{p.checkins === 1 ? "" : "s"}</span>
                    </td>
                    <td className="num py-3 pr-4 text-right text-muted-foreground">
                      {scorePct(p.data_quality) !== null ? `${scorePct(p.data_quality)}%` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {p.readiness_status
                        ? <StatusPill tone={READINESS_TONE[p.readiness_status]}>{STATUS_LABEL[p.readiness_status].title}</StatusPill>
                        : <span className="text-xs text-muted-foreground">Not assessed</span>}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{STAGE_LABEL[p.stage]}</td>
                    <td className="py-3 pr-4"><ConsentCell consent={p.consent} /></td>
                    <td className="py-3">
                      {!p.next_action ? <span className="text-xs text-muted-foreground">—</span>
                        : p.contacted_at ? <StatusPill tone="neutral">Contacted</StatusPill>
                        : leads ? (
                          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs"
                            onClick={() => setLogFor({ action: p.next_action!, people: [p] })}>
                            <MessageCircle size={13} /> {ACTION[p.next_action].label}
                          </Button>
                        ) : <StatusPill tone={ACTION[p.next_action].tone}>{ACTION[p.next_action].label}</StatusPill>}
                    </td>
                  </tr>
                );
              })}
              {participants.data && rows.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No participant matches these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {community.status === "verified" && (leads || profile?.role === "admin") && <EnrollForm onEnrolled={setConsentFor} />}

      {consentFor && (
        <ConsentDialog communityId={community.id} entrepreneur={consentFor} current={null}
          open onOpenChange={(v) => !v && setConsentFor(null)} />
      )}

      {logFor && (
        <OutreachDialog communityId={community.id} action={logFor.action} people={logFor.people}
          open onOpenChange={(v) => !v && setLogFor(null)} />
      )}
    </div>
  );
}

function EnrollForm({ onEnrolled }: { onEnrolled: (p: { entrepreneur_id: string; display_name: string }) => void }) {
  const { community } = useCommunity();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", business: "", sector: "" });
  const enroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await platform.rpc("enroll_entrepreneur", {
        p_community_id: community.id,
        p_display_name: form.name,
        p_business_name: form.business || undefined,
        p_business_sector: form.sector || undefined,
        p_city: community.city,
        p_state: community.state,
      });
      if (error) throw error;
      return { entrepreneur_id: data as string, display_name: form.name };
    },
    onSuccess: (enrolled) => {
      setForm({ name: "", business: "", sector: "" });
      for (const key of ["ci-participants", "ci-overview", "ci-cohorts"]) {
        queryClient.invalidateQueries({ queryKey: ["platform", key, community.id] });
      }
      toast.success("Enrolled. Her borrower reference is being registered on devnet. Now record her consent form.");
      onEnrolled(enrolled);
    },
    onError: (error) => toast.error(describeError(error)),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    enroll.mutate();
  };

  return (
    <Panel title="Add a participant" description="She gets a random borrower reference; only its hash goes on chain. Her consent form comes next: nothing of hers is assessed without it.">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="m-name">Name</Label>
          <Input id="m-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-business">Business <span className="font-normal text-muted-foreground">— optional</span></Label>
          <Input id="m-business" maxLength={120} value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-sector">Sector <span className="font-normal text-muted-foreground">— optional</span></Label>
          <Input id="m-sector" maxLength={80} value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
        </div>
        <Button type="submit" disabled={enroll.isPending} className="gap-2">
          {enroll.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Enroll
        </Button>
      </form>
    </Panel>
  );
}
