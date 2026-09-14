import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../auth/useAuth";
import { describeError } from "../lib/errors";
import { KIND_LABEL, platform } from "../lib/platform";
import { ELIGIBILITY_REASON, pseudonym } from "../lib/credit";
import { money, PURPOSE_LABEL } from "../lib/readiness";
import LoadError from "../components/LoadError";

export default function AdminReviewPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const pending = useQuery({
    queryKey: ["platform", "pending-communities"],
    queryFn: async () => {
      const { data, error } = await platform
        .from("communities")
        .select("id, name, kind, city, state, description, leader_id, created_at")
        .eq("status", "pending_verification")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const flagged = useQuery({
    queryKey: ["platform", "flagged-opportunities"],
    queryFn: async () => {
      const { data, error } = await platform
        .from("qualified_credit_opportunities")
        .select("id, entrepreneur_id, amount_cents, term_months, purpose, status, eligibility:eligibility_assessments(reason_codes, confidence)")
        .in("status", ["in_review", "open"])
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const refer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await platform.rpc("refer_opportunity", { p_opportunity_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform"] });
      toast.success("Referred to the matching partner.");
    },
    onError: (error) => toast.error(describeError(error)),
  });

  const review = useMutation({
    mutationFn: async ({ id, verdict }: { id: string; verdict: "verify" | "reject" }) => {
      const note = notes[id] ?? "";
      const { error } =
        verdict === "verify"
          ? await platform.rpc("verify_community", { p_community_id: id, p_note: note || undefined })
          : await platform.rpc("reject_community", { p_community_id: id, p_note: note });
      if (error) throw error;
      return verdict;
    },
    onSuccess: (verdict) => {
      queryClient.invalidateQueries({ queryKey: ["platform"] });
      toast.success(verdict === "verify" ? "Verified. The verification is being anchored on devnet." : "Rejected.");
    },
    onError: (error) => toast.error(describeError(error)),
  });

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-foreground">Review queue</h1>
        <p className="text-muted-foreground">
          Communities waiting for verification. Nobody verifies a community they lead.
        </p>
      </div>

      {pending.isLoading && <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />}
      {pending.isError && <LoadError error={pending.error} onRetry={() => pending.refetch()} />}
      {pending.data?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nothing to review.
        </p>
      )}

      <ul className="space-y-4">
        {pending.data?.map((c) => {
          const own = c.leader_id === profile?.id;
          const busy = review.isPending && review.variables?.id === c.id;
          return (
            <li key={c.id} className="space-y-4 rounded-2xl p-6 glass glow-border">
              <div className="space-y-1">
                <Link to={`/app/community/${c.id}`} className="font-heading text-lg font-bold text-foreground hover:text-accent">
                  {c.name}
                </Link>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin size={14} /> {c.city}, {c.state} · {KIND_LABEL[c.kind]}
                </p>
                {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
              </div>
              {own ? (
                <p className="text-sm text-muted-foreground">You lead this community, so another admin has to review it.</p>
              ) : (
                <>
                  <Textarea aria-label="Review note" rows={2} maxLength={500}
                    placeholder="Note — required to reject, optional to verify"
                    value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                  <div className="flex flex-wrap gap-3">
                    <Button disabled={busy} onClick={() => review.mutate({ id: c.id, verdict: "verify" })}
                      className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Verify
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => review.mutate({ id: c.id, verdict: "reject" })}
                      className="gap-2">
                      <X size={16} /> Reject
                    </Button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 pt-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">Opportunities for review</h2>
        <p className="text-muted-foreground">
          Requests the eligibility rules were not confident about, or that no partner covered yet. Review, then refer.
        </p>
      </div>
      {flagged.isError && <LoadError compact error={flagged.error} onRetry={() => flagged.refetch()} />}
      {flagged.data?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">Nothing flagged.</p>
      )}
      <ul className="space-y-3">
        {flagged.data?.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 glass glow-border">
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {pseudonym(o.entrepreneur_id)} · {money(o.amount_cents)} over {o.term_months} months · {PURPOSE_LABEL[o.purpose].toLowerCase()}
              </p>
              <p className="text-xs text-muted-foreground">
                {(o.eligibility?.reason_codes ?? []).map((r) => ELIGIBILITY_REASON[r] ?? r).join(" · ")}
              </p>
            </div>
            <Button disabled={refer.isPending} onClick={() => refer.mutate(o.id)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {refer.isPending && refer.variables === o.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Refer to partner
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
