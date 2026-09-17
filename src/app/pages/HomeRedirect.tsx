import { Navigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useLedCommunity } from "./community/queries";
import { AREAS, HOME } from "../lib/stories";
import { tr } from "../i18n";

/**
 * Each role starts at the story it is for: a sponsor at Impact Intelligence, an
 * investor at the Investor Console, the desk at its desk, a leader inside her
 * community, an entrepreneur at her business, auditors at the audit console,
 * admins at Impact Intelligence.
 */
export default function HomeRedirect() {
  const { profile } = useAuth();
  const led = useLedCommunity();
  const [params] = useSearchParams();
  // A community view asked for by path (?community=/participants), from "View platform as".
  const inside = params.get("community")?.startsWith("/") ? params.get("community")! : "";
  if (!profile || (profile.role === "community_leader" && led.isPending)) {
    return <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;
  }
  const home = profile.role === "community_leader" && led.data
    ? `/app/community/${led.data.id}${inside}`
    : AREAS.find((a) => a.id === HOME[profile.role])!.to;
  return <Navigate to={home} replace />;
}
