import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProofStatus from "../components/ProofStatus";
import { useAuth } from "../auth/useAuth";
import { anchorsSettled } from "../lib/anchors";
import {
  DECISION_LABEL,
  ELIGIBILITY_REASON,
  LOAN_LABEL,
  NEXT_STATUSES,
  OPPORTUNITY_LABEL,
  percent,
  pseudonym,
  type LoanStatus,
} from "../lib/credit";
import { describeError } from "../lib/errors";
import { platform } from "../lib/platform";
import { money, PURPOSE_LABEL } from "../lib/readiness";

// The partner's desk. Opportunities arrive pseudonymous — a code, the request,
// EmpowerFI's assessment, readiness indicators, the verified community and the
// sector — and the lending decision is the partner's alone.

type Pipeline = Awaited<ReturnType<typeof loadPipeline>>[number];

async function loadPipeline() {
  const { data, error } = await platform.rpc("partner_pipeline");
  if (error) throw error;
  return data;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function DecisionForm({ o, onDone }: { o: Pipeline; onDone: () => void }) {
  const [amount, setAmount] = useState(String(o.amount_cents / 100));
  const [rate, setRate] = useState("3.0");
  const [term, setTerm] = useState(String(o.term_months));
  const [reason, setReason] = useState("");

  const decide = useMutation({
    mutationFn: async (verdict: "approved" | "declined") => {
      const { error } = await platform.rpc("partner_decide", {
        p_opportunity_id: o.opportunity_id,
        p_verdict: verdict,
        ...(verdict === "approved"
          ? {
              p_approved_amount_cents: Math.round(Number(amount) * 100),
              p_rate_bps: Math.round(Number(rate) * 100),
              p_term_months: Number(term),
            }
          : {}),
        p_reason: reason || undefined,
      });
      if (error) throw error;
      return verdict;
    },
    onSuccess: (v) => {
      toast.success(v === "approved" ? "Approved. The loan is open and its approval is being anchored." : "Declined.");
      onDone();
    },
    onError: (e) => toast.error(describeError(e)),
  });

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`a-${o.opportunity_id}`}>Amount (R$)</Label>
          <Input id={`a-${o.opportunity_id}`} type="number" min={100} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`r-${o.opportunity_id}`}>Your rate (% a month)</Label>
          <Input id={`r-${o.opportunity_id}`} type="number" min={0} max={10} step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`t-${o.opportunity_id}`}>Term (months)</Label>
          <Input id={`t-${o.opportunity_id}`} type="number" min={1} max={24} value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>
      <Textarea aria-label="Reason" rows={2} maxLength={500} placeholder="Note or reason (shared with EmpowerFI)" value={reason}
        onChange={(e) => setReason(e.target.value)} />
      <div className="flex flex-wrap gap-3">
        <Button disabled={decide.isPending} onClick={() => decide.mutate("approved")} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          {decide.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve
        </Button>
        <Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate("declined")} className="gap-2">
          <X size={16} /> Decline
        </Button>
      </div>
    </div>
  );
}

export default function PartnerPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform"] });

  const partner = useQuery({
    queryKey: ["platform", "partner", profile?.partner_id],
    enabled: Boolean(profile?.partner_id),
    queryFn: async () => {
      const { data, error } = await platform.from("partners").select("name, min_ticket_cents, max_ticket_cents").eq("id", profile!.partner_id!).single();
      if (error) throw error;
      return data;
    },
  });
  const pipeline = useQuery({ queryKey: ["platform", "partner-pipeline"], queryFn: loadPipeline });
  const loans = useQuery({
    queryKey: ["platform", "partner-loans"],
    queryFn: async () => {
      const { data, error } = await platform
        .from("loans")
        .select("*, payments(instalment_no, amount_cents, paid_at), loan_events(id, to_status, created_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const proofIds = (loans.data ?? []).flatMap((l) => [l.id, ...(l.loan_events ?? []).map((e) => e.id)]);
  // Admins and auditors can follow the desk; only the partner decides.
  const decides = profile?.role === "partner";
  const anchors = useQuery({
    queryKey: ["platform", "partner-anchors", proofIds],
    enabled: proofIds.length > 0,
    queryFn: async () => {
      const { data, error } = await platform.from("chain_anchors").select("*").in("entity_id", proofIds);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (anchorsSettled(q.state.data) ? false : 4000),
  });

  const move = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: LoanStatus }) => {
      const { error } = await platform.rpc("transition_loan", { p_loan_id: id, p_to: to });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(describeError(e)),
  });
  const pay = useMutation({
    mutationFn: async ({ id, n, cents }: { id: string; n: number; cents: number }) => {
      const { error } = await platform.rpc("record_payment", { p_loan_id: id, p_instalment_no: n, p_amount_cents: cents });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(describeError(e)),
  });

  if (pipeline.isLoading || loans.isLoading) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;

  const waiting = pipeline.data?.filter((o) => o.status === "referred") ?? [];
  const decided = pipeline.data?.filter((o) => o.status !== "referred") ?? [];
  const live = (loans.data ?? []).filter((l) => ["DISBURSED", "ACTIVE", "PAID", "DEFAULTED"].includes(l.status));
  const received = (loans.data ?? []).reduce((sum, l) => sum + (l.payments ?? []).reduce((s, p) => s + p.amount_cents, 0), 0);

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Partner desk</p>
        <h1 className="font-heading text-3xl font-bold text-foreground">{partner.data?.name ?? "Credit partner"}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          EmpowerFI prepares and qualifies; the lending decision, the price and the capital are yours. Participants appear
          under a code: indicators to decide on, not personal data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Awaiting decision" value={waiting.length} />
        <Stat label="Approved" value={decided.filter((o) => o.status === "partner_approved").length} />
        <Stat label="Declined" value={decided.filter((o) => o.status === "partner_declined").length} />
        <Stat label="Disbursed" value={money(live.reduce((s, l) => s + l.principal_cents, 0))} />
        <Stat label="Received" value={money(received)} />
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-foreground">Awaiting your decision</h2>
        {waiting.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
        <ul className="space-y-4">
          {waiting.map((o) => {
            const d = DECISION_LABEL[o.eligibility_decision];
            return (
              <li key={o.opportunity_id} className="space-y-4 rounded-2xl p-5 glass glow-border sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-lg font-bold text-foreground">{o.participant}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.business_sector ?? "—"} · {o.community_name} ({o.community_city}, {o.community_state})
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${d.tone}`}>EmpowerFI: {d.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <span>
                    <span className="block text-xs text-muted-foreground">{o.requested_amount_cents !== o.amount_cents ? "Proposed" : "Request"}</span>
                    {money(o.amount_cents)} · {PURPOSE_LABEL[o.purpose].toLowerCase()}
                    {o.requested_amount_cents !== o.amount_cents && (
                      <span className="block text-xs text-muted-foreground">asked {money(o.requested_amount_cents)}</span>
                    )}
                  </span>
                  <span><span className="block text-xs text-muted-foreground">Sized at</span>{o.term_months} × {money(o.instalment_cents)}</span>
                  <span><span className="block text-xs text-muted-foreground">Instalment / monthly result</span>{percent(o.affordability_bps)}</span>
                  <span><span className="block text-xs text-muted-foreground">Risk · confidence</span>{o.risk_band.toLowerCase()} · {o.confidence.toLowerCase()}</span>
                  <span><span className="block text-xs text-muted-foreground">Avg sales / result</span>{money(o.avg_revenue_cents)} / {money(o.avg_net_business_cents)}</span>
                  <span><span className="block text-xs text-muted-foreground">History</span>{o.months_reported} months · readiness {o.readiness_band.toLowerCase()}</span>
                  <span><span className="block text-xs text-muted-foreground">Suggested range</span>{money(o.suggested_min_cents)} – {money(o.suggested_max_cents)}</span>
                  <span><span className="block text-xs text-muted-foreground">Sales variation</span>{percent(o.revenue_cv_bps)}</span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {o.eligibility_reasons.map((r) => (
                    <li key={r} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{ELIGIBILITY_REASON[r] ?? r}</li>
                  ))}
                </ul>
                {decides && <DecisionForm o={o} onDone={refresh} />}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-foreground">Loans</h2>
        {(loans.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No loans yet.</p>}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
          {(loans.data ?? []).map((l) => {
            const paid = (l.payments ?? []).length;
            const nextInstalment = paid + 1;
            const busy = (move.isPending && move.variables?.id === l.id) || (pay.isPending && pay.variables?.id === l.id);
            const latestEvent = [...(l.loan_events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
            return (
              <li key={l.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {pseudonym(l.entrepreneur_id)} · {money(l.principal_cents)} · {l.term_months} × {money(l.instalment_cents)} at {(l.rate_bps / 100).toFixed(1)}%/month
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {LOAN_LABEL[l.status]} · {paid} of {l.term_months} instalments received
                    </p>
                  </div>
                  <div className={`flex flex-wrap gap-2 ${decides ? "" : "hidden"}`}>
                    {(l.status === "DISBURSED" || l.status === "ACTIVE") && nextInstalment <= l.term_months && (
                      <Button size="sm" variant="outline" disabled={busy}
                        onClick={() => pay.mutate({ id: l.id, n: nextInstalment, cents: l.instalment_cents })}>
                        Record instalment {nextInstalment}
                      </Button>
                    )}
                    {NEXT_STATUSES[l.status]
                      .filter((to) => to !== "PAID" || paid >= l.term_months)
                      .map((to) => (
                        <Button key={to} size="sm" disabled={busy} variant={to === "CANCELLED" || to === "DEFAULTED" ? "ghost" : "default"}
                          className={to === "CANCELLED" || to === "DEFAULTED" ? "" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                          onClick={() => move.mutate({ id: l.id, to })}>
                          {busy && <Loader2 size={14} className="mr-1 animate-spin" />}
                          {{ DISBURSED: "Mark disbursed", ACTIVE: "Start repayment", PAID: "Mark paid off", DEFAULTED: "Mark defaulted", CANCELLED: "Cancel", DRAFT: "", PARTNER_APPROVED: "" }[to]}
                        </Button>
                      ))}
                  </div>
                </div>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <ProofStatus loading={anchors.isPending} label="Loan terms on chain" anchor={anchors.data?.find((a) => a.entity_id === l.id)} />
                  {latestEvent && (
                    <ProofStatus loading={anchors.isPending} label={`Status: ${LOAN_LABEL[latestEvent.to_status]}`}
                      anchor={anchors.data?.find((a) => a.entity_id === latestEvent.id)} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-bold text-foreground">Decided</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
            {decided.map((o) => (
              <li key={o.opportunity_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="text-foreground">{o.participant} · {money(o.amount_cents)} · {o.business_sector}</span>
                <span className="text-muted-foreground">{OPPORTUNITY_LABEL[o.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
