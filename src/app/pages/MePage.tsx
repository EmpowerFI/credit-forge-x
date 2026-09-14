import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, ClipboardPlus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import MemberEducation from "../components/MemberEducation";
import ProofStatus from "../components/ProofStatus";
import { useAuth } from "../auth/useAuth";
import { anchorsSettled } from "../lib/anchors";
import { loadEducation } from "../lib/education";
import { describeError } from "../lib/errors";
import { requestAssessment } from "../lib/assessments";
import { platform } from "../lib/platform";
import {
  describeRequirement,
  money,
  monthLabel,
  PURPOSE_LABEL,
  REASON_LABEL,
  STATUS_LABEL,
  type CreditPurpose,
} from "../lib/readiness";

export default function MePage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["platform", "me", profile?.id],
    queryFn: async () => {
      const { data, error } = await platform
        .from("entrepreneurs")
        .select("id, display_name, business_name, business_sector, city, state, community_memberships(community_id)")
        .eq("profile_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(profile),
  });
  const id = me.data?.id;
  const communityId = me.data?.community_memberships?.[0]?.community_id;

  const business = useQuery({
    queryKey: ["platform", "my-business", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [readiness, intent, months] = await Promise.all([
        platform.from("latest_readiness").select("*").eq("entrepreneur_id", id!).maybeSingle(),
        platform.from("credit_intents").select("*").eq("entrepreneur_id", id!).eq("status", "active").maybeSingle(),
        platform.from("checkin_cash_flow").select("*").eq("entrepreneur_id", id!).order("period", { ascending: false }).limit(6),
      ]);
      for (const r of [readiness, intent, months]) if (r.error) throw r.error;
      return { readiness: readiness.data, intent: intent.data, months: months.data ?? [] };
    },
  });

  const entityIds = [business.data?.readiness?.id, ...(business.data?.months.map((m) => m.checkin_id) ?? [])].filter(
    Boolean,
  ) as string[];
  const anchors = useQuery({
    queryKey: ["platform", "my-anchors", entityIds],
    enabled: entityIds.length > 0,
    queryFn: async () => {
      const { data, error } = await platform.from("chain_anchors").select("*").in("entity_id", entityIds);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (anchorsSettled(q.state.data) ? false : 4000),
  });
  const anchorOf = (entityId: string | undefined) => anchors.data?.find((a) => a.entity_id === entityId);

  const education = useQuery({
    queryKey: ["platform", "education", communityId, id],
    enabled: Boolean(communityId && id),
    queryFn: () => loadEducation(communityId!, [id!]),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform"] });

  const assess = useMutation({
    mutationFn: () => requestAssessment(id!),
    onSuccess: (r) => {
      refresh();
      toast.success(r.reused ? "Nothing has changed since your last assessment." : `Assessment ${r.assessment_no}: ${STATUS_LABEL[r.result.status].title}.`);
    },
    onError: (e) => toast.error(describeError(e)),
  });

  const [asking, setAsking] = useState(false);
  const [intentForm, setIntentForm] = useState({ purpose: "" as CreditPurpose | "", amount: "", description: "" });
  const declare = useMutation({
    mutationFn: async () => {
      const { error } = await platform.rpc("declare_credit_intent", {
        p_purpose: intentForm.purpose as CreditPurpose,
        p_requested_amount_cents: Math.round(Number(intentForm.amount) * 100),
        p_description: intentForm.description || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAsking(false);
      refresh();
      toast.success("Request recorded. It goes to eligibility next — nothing is approved yet.");
    },
    onError: (e) => toast.error(describeError(e)),
  });
  const withdraw = useMutation({
    mutationFn: async () => {
      const { error } = await platform.rpc("withdraw_credit_intent");
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Request withdrawn.");
    },
    onError: (e) => toast.error(describeError(e)),
  });

  if (me.isLoading || business.isLoading) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;
  if (!me.data) {
    return <p className="text-muted-foreground">This page is for entrepreneurs. Your account has no business on record.</p>;
  }

  const readiness = business.data?.readiness;
  const status = readiness ? STATUS_LABEL[readiness.status] : null;
  const missing = (readiness?.missing_requirements ?? []) as { code: string; current: number | null; required: number }[];
  const intent = business.data?.intent;

  const submitIntent = (e: FormEvent) => {
    e.preventDefault();
    if (!intentForm.purpose) return toast.error("Choose what the capital is for.");
    declare.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{me.data.display_name}</p>
          <h1 className="font-heading text-3xl font-bold text-foreground">{me.data.business_name ?? "My business"}</h1>
        </div>
        <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link to="/app/check-in"><ClipboardPlus size={16} /> Monthly check-in</Link>
        </Button>
      </div>

      {/* ------------------------------------------------------ readiness */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-foreground">Readiness</h2>
          <Button variant="outline" size="sm" disabled={assess.isPending} onClick={() => assess.mutate()} className="gap-2">
            {assess.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Re-assess
          </Button>
        </div>

        {!readiness || !status ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No assessment yet. Send your first monthly check-in, and the business will be assessed.
          </p>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-5 ${status.tone}`}>
              <p className="text-xs font-medium uppercase tracking-widest opacity-80">
                Assessment {readiness.assessment_no} · {monthLabel(readiness.as_of_period)} · band {readiness.band.toLowerCase()}
              </p>
              <p className="mt-1 font-heading text-2xl font-bold">{status.title}</p>
              <p className="text-sm">{status.summary}</p>
            </div>

            {missing.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Still to do</p>
                <ul className="space-y-2">
                  {missing.map((m) => (
                    <li key={m.code} className="flex items-start gap-2 text-sm text-foreground">
                      <CircleDashed size={16} className="mt-0.5 shrink-0 text-accent" /> {describeRequirement(m)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {readiness.reason_codes.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {readiness.reason_codes.map((code) => {
                  const r = REASON_LABEL[code] ?? { text: code, positive: true };
                  return (
                    <li key={code} className={`rounded-full border px-3 py-1 text-xs ${r.positive ? "border-emerald-300 text-emerald-800" : "border-amber-300 text-amber-800"}`}>
                      {r.text}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="rounded-xl border border-border bg-background/60 px-4">
              <ProofStatus label="Assessment attested" anchor={anchorOf(readiness.id)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Model {readiness.model_version}. Readiness is not a credit decision: it says whether the business is prepared
              to have that conversation.
            </p>
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- credit */}
      {readiness?.status === "CREDIT_READY" && (
        <section className="space-y-4 rounded-2xl p-6 glass glow-border">
          <h2 className="font-heading text-xl font-bold text-foreground">Capital</h2>
          {intent ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                You asked for <strong>{money(intent.requested_amount_cents)}</strong> for{" "}
                {PURPOSE_LABEL[intent.purpose].toLowerCase()}. It goes to an eligibility check next; a financial partner
                makes any lending decision.
              </p>
              <Button variant="outline" size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
                Withdraw the request
              </Button>
            </div>
          ) : !asking ? (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm text-foreground">
                <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                Your business is ready for a credit conversation. Nothing happens unless you ask — being ready and not
                needing credit is a good place to be.
              </p>
              <Button variant="outline" onClick={() => setAsking(true)}>I would like to request capital</Button>
            </div>
          ) : (
            <form onSubmit={submitIntent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="i-purpose">What is it for?</Label>
                <Select value={intentForm.purpose} onValueChange={(v) => setIntentForm({ ...intentForm, purpose: v as CreditPurpose })}>
                  <SelectTrigger id="i-purpose"><SelectValue placeholder="Choose a purpose" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-amount">How much? (R$ 100 to R$ 50,000)</Label>
                <Input id="i-amount" type="number" inputMode="decimal" min={100} max={50000} step="0.01" required
                  value={intentForm.amount} onChange={(e) => setIntentForm({ ...intentForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-desc">In a sentence <span className="font-normal text-muted-foreground">— optional</span></Label>
                <Textarea id="i-desc" rows={2} maxLength={500} value={intentForm.description}
                  onChange={(e) => setIntentForm({ ...intentForm, description: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={declare.isPending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  {declare.isPending && <Loader2 size={16} className="animate-spin" />} Send request
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAsking(false)}>Not now</Button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ------------------------------------------------------ cash flow */}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-foreground">Cash flow</h2>
        {business.data?.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No months reported yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
            {business.data?.months.map((m) => (
              <li key={m.checkin_id} className="grid gap-2 px-4 py-3 sm:grid-cols-[6rem_1fr] sm:items-center">
                <p className="font-medium text-foreground">{monthLabel(m.period!)}</p>
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    <span><span className="text-xs text-muted-foreground">Sales</span><br />{money(m.revenue_cents)}</span>
                    <span><span className="text-xs text-muted-foreground">Costs</span><br />{money((m.cogs_cents ?? 0) + (m.opex_cents ?? 0))}</span>
                    <span><span className="text-xs text-muted-foreground">Household</span><br />{money(m.household_cents)}</span>
                    <span>
                      <span className="text-xs text-muted-foreground">Business result</span><br />
                      <span className={(m.net_business_cents ?? 0) > 0 ? "text-emerald-700" : "text-red-700"}>{money(m.net_business_cents)}</span>
                    </span>
                  </div>
                  <ProofStatus label="Month anchored" anchor={anchorOf(m.checkin_id!)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ education */}
      {education.data && (
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-bold text-foreground">Education</h2>
          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <MemberEducation programmes={education.data.programmes} completed={education.data.completed.get(id!)} />
          </div>
        </section>
      )}
    </div>
  );
}
