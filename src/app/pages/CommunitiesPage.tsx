import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../auth/useAuth";
import { KIND_LABEL, platform } from "../lib/platform";
import LoadError from "../components/LoadError";
import { tr } from "../i18n";

export default function CommunitiesPage() {
  const { profile } = useAuth();
  const canCreate = profile?.role === "community_leader" || profile?.role === "admin";

  // RLS decides what each role sees: the verified directory for everyone,
  // plus a leader's own pending communities, plus everything for admins.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["platform", "communities"],
    queryFn: async () => {
      const { data, error } = await platform
        .from("communities")
        .select("id, name, kind, city, state, status, leader_id, is_simulated, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-bold text-foreground">{tr({ en: "Communities", pt: "Comunidades" })}</h1>
          <p className="text-muted-foreground">
            {tr({
              en: "Programmes and groups that prepare entrepreneurs before credit.",
              pt: "Programas e grupos que preparam empreendedoras antes do crédito.",
            })}
          </p>
        </div>
        {canCreate && (
          <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/app/community/new"><Plus size={16} /> {tr({ en: "New community", pt: "Nova comunidade" })}</Link>
          </Button>
        )}
      </div>

      {isLoading && <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />}
      {error && <LoadError error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {canCreate
            ? tr({ en: "No communities yet — create the first one.", pt: "Ainda não há comunidades — crie a primeira." })
            : tr({ en: "No communities yet.", pt: "Ainda não há comunidades." })}
        </p>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {data?.map((c) => (
          <li key={c.id}>
            <Link to={`/app/community/${c.id}`}
              className="block h-full space-y-3 rounded-2xl p-6 glass glow-border transition-shadow hover:shadow-glow">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-heading text-lg font-bold text-foreground">{c.name}</h2>
                <StatusBadge status={c.status} />
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin size={14} /> {c.city}, {c.state} · {KIND_LABEL[c.kind]}
              </p>
              {c.leader_id === profile?.id && <p className="text-xs font-medium text-accent">{tr({ en: "You lead this community", pt: "Você lidera esta comunidade" })}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
