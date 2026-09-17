import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import LoadError from "../components/LoadError";
import { ROLE_LABEL, type Role } from "../lib/platform";
import { Button } from "@/components/ui/button";
import { areaOf } from "../lib/stories";
import { useAuth } from "./useAuth";
import { useOpenArea } from "./useOpenArea";
import { tr } from "../i18n";

/** Signed-in users only; with `roles`, only those roles. */
export default function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, profile, loading, profileError, retryProfile } = useAuth();
  const location = useLocation();
  const { open, switching, demo } = useOpenArea();
  const area = areaOf(location.pathname);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
      </div>
    );
  }
  if (!session) {
    return <Navigate to={`/app/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!profile && profileError) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <LoadError error={profileError} onRetry={retryProfile} />
      </div>
    );
  }
  if (roles && (!profile || !roles.includes(profile.role))) {
    return (
      <div className="mx-auto max-w-lg space-y-2 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {tr({ en: "Not available for your role", pt: "Não disponível para o seu perfil" })}
        </h1>
        <p className="text-muted-foreground">
          {tr({
            en: `This page is for ${roles.map((r) => ROLE_LABEL[r]).join(", ")}.`,
            pt: `Esta página é para: ${roles.map((r) => ROLE_LABEL[r]).join(", ")}.`,
          })}
        </p>
        {demo && area && (
          <Button className="mt-4" disabled={switching !== null} onClick={() => void open(area, location.pathname + location.search)}>
            {switching ? <Loader2 size={16} className="animate-spin" /> : null}
            {tr({ en: `Enter as the demo ${area.persona.name}`, pt: `Entrar como ${area.persona.name}, conta demo` })}
          </Button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
