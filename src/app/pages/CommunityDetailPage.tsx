import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2, MapPin, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProofStatus from "../components/ProofStatus";
import { anchorsSettled } from "../lib/anchors";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../auth/useAuth";
import { describeError } from "../lib/errors";
import { KIND_LABEL, platform } from "../lib/platform";

export default function CommunityDetailPage() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const community = useQuery({
    queryKey: ["platform", "community", id],
    queryFn: async () => {
      const { data, error } = await platform.from("communities").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    queryKey: ["platform", "members", id],
    queryFn: async () => {
      const { data, error } = await platform
        .from("community_memberships")
        .select("joined_at, status, entrepreneur:entrepreneurs(id, display_name, business_name, business_sector)")
        .eq("community_id", id)
        .order("joined_at");
      if (error) throw error;
      return data;
    },
  });

  const memberIds = members.data?.map((m) => m.entrepreneur?.id).filter(Boolean) as string[] | undefined;

  // The community's own proofs and its members' enrollments, polled while
  // any of them is still on its way to the chain.
  const anchors = useQuery({
    queryKey: ["platform", "anchors", id, memberIds],
    enabled: members.isSuccess,
    queryFn: async () => {
      const { data, error } = await platform
        .from("chain_anchors")
        .select("*")
        .in("entity_id", [id, ...(memberIds ?? [])]);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (anchorsSettled(q.state.data) ? false : 4000),
  });

  const anchorFor = (kind: string, entityId: string) =>
    anchors.data?.find((a) => a.kind === kind && a.entity_id === entityId);

  const [form, setForm] = useState({ name: "", business: "", sector: "" });
  const enroll = useMutation({
    mutationFn: async () => {
      const { error } = await platform.rpc("enroll_entrepreneur", {
        p_community_id: id,
        p_display_name: form.name,
        p_business_name: form.business || undefined,
        p_business_sector: form.sector || undefined,
        p_city: community.data?.city,
        p_state: community.data?.state,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ name: "", business: "", sector: "" });
      queryClient.invalidateQueries({ queryKey: ["platform", "members", id] });
      queryClient.invalidateQueries({ queryKey: ["platform", "anchors", id] });
      toast.success("Enrolled. Her borrower reference is being registered on devnet.");
    },
    onError: (error) => toast.error(describeError(error)),
  });

  if (community.isLoading) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;
  const c = community.data;
  if (!c) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-muted-foreground">This community does not exist, or you do not have access to it.</p>
        <Link to="/app/community" className="text-sm text-accent">Back to communities</Link>
      </div>
    );
  }

  const leads = c.leader_id === profile?.id;
  const canEnroll = c.status === "verified" && (leads || profile?.role === "admin");
  const canSeeMembers = leads || profile?.role === "admin" || profile?.role === "auditor";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    enroll.mutate();
  };

  return (
    <div className="space-y-8">
      <Link to="/app/community" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Communities
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold text-foreground">{c.name}</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin size={15} /> {c.city}, {c.state} · {KIND_LABEL[c.kind]}
          </p>
          {c.description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{c.description}</p>}
        </div>
        <StatusBadge status={c.status} />
      </div>

      {c.status === "pending_verification" && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock size={16} className="mt-0.5 shrink-0" />
          Waiting for EmpowerFI to verify this community. Entrepreneurs can be enrolled once it is verified.
        </p>
      )}
      {c.status === "rejected" && c.review_note && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">Rejected: {c.review_note}</p>
      )}

      <section className="rounded-2xl p-6 glass glow-border">
        <h2 className="mb-2 font-heading text-lg font-bold text-foreground">Proofs on Solana</h2>
        <div className="divide-y divide-border">
          <ProofStatus label="Community registered" anchor={anchorFor("community", c.id)} />
          <ProofStatus label="Community verified" anchor={anchorFor("community_verification", c.id)} />
        </div>
      </section>

      {canSeeMembers && (
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-bold text-foreground">Members</h2>
          {members.data?.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
            {members.data?.map((m) => m.entrepreneur && (
              <li key={m.entrepreneur.id} className="grid gap-1 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center md:gap-6">
                <div>
                  <p className="font-medium text-foreground">{m.entrepreneur.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[m.entrepreneur.business_name, m.entrepreneur.business_sector].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="min-w-[16rem]">
                  <ProofStatus label="Borrower ref" anchor={anchorFor("enrollment", m.entrepreneur.id)} />
                </div>
              </li>
            ))}
          </ul>

          {canEnroll && (
            <form onSubmit={submit} className="grid gap-4 rounded-2xl p-6 glass glow-border md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" required maxLength={80} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-business">Business <span className="font-normal text-muted-foreground">— optional</span></Label>
                <Input id="m-business" maxLength={120} value={form.business}
                  onChange={(e) => setForm({ ...form, business: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-sector">Sector <span className="font-normal text-muted-foreground">— optional</span></Label>
                <Input id="m-sector" maxLength={80} value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })} />
              </div>
              <Button type="submit" disabled={enroll.isPending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                {enroll.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Enroll
              </Button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
