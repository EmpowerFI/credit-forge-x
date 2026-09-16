import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2, MapPin } from "lucide-react";
import LoadError from "../../components/LoadError";
import ProofStatus from "../../components/ProofStatus";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../auth/useAuth";
import { anchorsSettled } from "../../lib/anchors";
import { KIND_LABEL, platform } from "../../lib/platform";
import { COMMUNITY_TABS } from "../../lib/community";
import { useCommunityRow } from "./queries";
import { tr } from "../../i18n";

/**
 * A community's workspace: who it is, whether Solana has its proofs, and the
 * six views of Community Intelligence below. Leaders, auditors and admins see
 * the views; anyone else sees the community's public face only.
 */
export default function CommunityLayout() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const community = useCommunityRow(id);

  const anchors = useQuery({
    queryKey: ["platform", "community-anchors", id],
    enabled: community.isSuccess && Boolean(community.data),
    queryFn: async () => {
      const { data, error } = await platform.from("chain_anchors").select("*").eq("entity_id", id)
        .in("kind", ["community", "community_verification"]);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (anchorsSettled(q.state.data) ? false : 4000),
  });

  if (community.isLoading) return <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;
  if (community.isError) return <LoadError error={community.error} onRetry={() => community.refetch()} />;
  const c = community.data;
  if (!c) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-muted-foreground">{tr({ en: "This community does not exist, or you do not have access to it.", pt: "Esta comunidade não existe, ou você não tem acesso a ela." })}</p>
        <Link to="/app/community" className="text-sm text-info">{tr({ en: "Back to communities", pt: "Voltar para as comunidades" })}</Link>
      </div>
    );
  }

  const leads = c.leader_id === profile?.id;
  const oversees = profile?.role === "admin" || profile?.role === "auditor";
  const anchor = (kind: string) => anchors.data?.find((a) => a.kind === kind);

  return (
    <div className="space-y-6">
      {!leads && (
        <Link to="/app/community" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> {tr({ en: "Communities", pt: "Comunidades" })}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">{tr({ en: "Community Intelligence", pt: "Inteligência Comunitária" })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin size={14} aria-hidden /> {c.city}, {c.state} · {KIND_LABEL[c.kind]}
          </p>
        </div>
        <div className="w-full max-w-sm divide-y divide-border rounded-xl border border-border bg-card/40 px-4 sm:w-auto">
          <ProofStatus loading={anchors.isPending} label={tr({ en: "Registered on Solana", pt: "Registrada na Solana" })} anchor={anchor("community")} />
          <ProofStatus loading={anchors.isPending} label={tr({ en: "Verified on Solana", pt: "Verificada na Solana" })} anchor={anchor("community_verification")} />
        </div>
      </div>

      {c.status === "pending_verification" && (
        <p className="flex items-start gap-2 rounded-xl border tone-caution p-4 text-sm">
          <Clock size={16} className="mt-0.5 shrink-0" aria-hidden />
          {tr({
            en: "Waiting for EmpowerFI to verify this community. Participants can be enrolled once it is verified.",
            pt: "Aguardando a EmpowerFI verificar esta comunidade. Depois da verificação, você pode cadastrar participantes.",
          })}
        </p>
      )}
      {c.status === "rejected" && c.review_note && (
        <p className="rounded-xl border tone-alert p-4 text-sm">{tr({ en: "Rejected", pt: "Recusada" })}: {c.review_note}</p>
      )}

      {leads || oversees ? (
        <>
          {/* A leader has these views in her sidebar; on a phone, and for those
              who oversee many communities, they sit here as tabs. */}
          <nav aria-label={tr({ en: "Community views", pt: "Áreas da comunidade" })}
            className={`-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 ${leads ? "lg:hidden" : ""}`}>
            {COMMUNITY_TABS.map((t) => (
              <NavLink key={t.label} to={t.to} end={"end" in t}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                    isActive ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <Outlet context={{ community: c, leads }} />
        </>
      ) : (
        c.description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{c.description}</p>
      )}
    </div>
  );
}
