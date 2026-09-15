import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../auth/useAuth";
import { ConsentScopes, ConsentSummary, ProofLine } from "../components/consent/ConsentScopes";
import LoadError from "../components/LoadError";
import { DataTag } from "../components/product/DataLegend";
import PageHeader from "../components/product/PageHeader";
import Panel from "../components/product/Panel";
import { anchorsSettled } from "../lib/anchors";
import { shortDate } from "../lib/community";
import {
  CHANNEL_LABEL, type Choices, choicesOf, consequences, type ConsentRecord, NONE, sameChoices, SCOPE_TEXT, SCOPES,
} from "../lib/consent";
import { describeError } from "../lib/errors";
import { platform } from "../lib/platform";

/**
 * Her consent, in her hands: the four uses of her data, what each reads and
 * who sees it, what changes if she changes her mind — and every record she
 * ever made, each proven on Solana.
 */
export default function ConsentPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["platform", "me", profile?.id],
    enabled: Boolean(profile),
    queryFn: async () => {
      const { data, error } = await platform.from("entrepreneurs")
        .select("id, display_name, business_name, business_sector, city, state, community_memberships(community_id)")
        .eq("profile_id", profile!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const id = me.data?.id;

  const records = useQuery({
    queryKey: ["platform", "consents", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await platform.from("consents").select("*").eq("entrepreneur_id", id!).order("consent_no", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const ids = records.data?.map((r) => r.id) ?? [];
  const anchors = useQuery({
    queryKey: ["platform", "consent-anchors", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await platform.from("chain_anchors").select("*").eq("kind", "consent").in("entity_id", ids);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (anchorsSettled(q.state.data) ? false : 4000),
  });

  const history: ConsentRecord[] = useMemo(() => (records.data ?? []).map((r) => {
    const a = anchors.data?.find((x) => x.entity_id === r.id);
    return {
      id: r.id, consent_no: r.consent_no, text_version: r.text_version, channel: r.channel, at: r.created_at,
      assessment: r.assessment, partner: r.partner, investors: r.investors, impact: r.impact,
      proof: a ? { kind: a.kind, entity_id: a.entity_id, status: a.status, signature: a.signature, reconcile: a.reconcile } : null,
    };
  }), [records.data, anchors.data]);
  const current = history[0] ?? null;

  const [draft, setDraft] = useState<Choices>(NONE);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(choicesOf(current));
  }, [current, touched]);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await platform.rpc("record_consent", {
        p_assessment: draft.assessment, p_partner: draft.partner, p_investors: draft.investors, p_impact: draft.impact,
      });
      if (error) throw error;
      return data as { consent_no: number; reused: boolean };
    },
    onSuccess: (r) => {
      setTouched(false);
      for (const key of ["consents", "consent-anchors", "my-business"]) queryClient.invalidateQueries({ queryKey: ["platform", key] });
      toast.success(r.reused ? "Nothing changed." : `Saved as record #${r.consent_no}. Its proof is on its way to Solana.`);
    },
    onError: (e) => toast.error(describeError(e)),
  });

  if (me.isError || records.isError) {
    return <LoadError error={me.error ?? records.error} onRetry={() => { me.refetch(); records.refetch(); }} />;
  }
  if (me.isPending || (id && records.isPending)) return <div className="space-y-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!me.data) return <p className="text-muted-foreground">This page is for entrepreneurs. Your account has no business on record.</p>;

  const changed = !current || !sameChoices(draft, choicesOf(current));
  const effects = changed ? consequences(current ? choicesOf(current) : null, draft) : [];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Privacy" title="Your consent"
        description="You decide what your data is used for. Every change is a new record, proven on Solana, so what you agreed to, and when, can always be checked." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="What you allow" description={`Wording ${history[0]?.text_version ?? "consent-v1"}. Change any of it at any time.`}>
          <ConsentScopes value={draft} onChange={(v) => { setDraft(v); setTouched(true); }} disabled={save.isPending} />

          {changed && (
            <div className="space-y-3 rounded-xl border border-info/40 bg-info/5 p-4 text-sm">
              <p className="font-medium text-foreground">{current ? "If you save" : "Your first record"}</p>
              {effects.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{effects.map((e) => <li key={e}>{e}</li>)}</ul>
              ) : (
                <p className="text-muted-foreground">
                  {SCOPES.filter((s) => draft[s]).length === 0
                    ? "Nothing of yours will be assessed or shared."
                    : `Allowed: ${SCOPES.filter((s) => draft[s]).map((s) => SCOPE_TEXT[s].title.toLowerCase()).join("; ")}.`}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
                  {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Save my choices
                </Button>
                {current && (
                  <Button variant="ghost" className="gap-2" onClick={() => { setDraft(choicesOf(current)); setTouched(false); }}>
                    <Undo2 size={15} /> Keep them as they are
                  </Button>
                )}
              </div>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="In force">
            <ConsentSummary record={current} compact />
          </Panel>

          <Panel title="Every record" description="Nothing is edited: each change is added, and each is proven.">
            {history.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <ol className="space-y-3">
                {history.map((r) => (
                  <li key={r.id} className="space-y-1 border-b border-border/60 pb-3 text-sm last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">#{r.consent_no}</span>
                      <span className="text-xs text-muted-foreground">{shortDate(r.at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {SCOPES.filter((s) => r[s]).map((s) => SCOPE_TEXT[s].title).join(" · ") || "Nothing allowed"}
                    </p>
                    <p className="text-xs text-muted-foreground">{CHANNEL_LABEL[r.channel]}</p>
                    <div className="text-xs"><ProofLine proof={r.proof} /></div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Whatever you choose">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><span className="mt-0.5"><DataTag kind="private" /></span>Your name, documents, contacts and monthly figures never go on chain.</li>
              <li className="flex items-start gap-2"><span className="mt-0.5"><DataTag kind="proven" /></span>Only a hash of each record does, so anyone can check it was not changed.</li>
              <li className="flex items-start gap-2"><span className="mt-0.5"><DataTag kind="derived" /></span>Scores and grades are computed from your data, and shown only where you allow.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
