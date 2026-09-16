import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useLedCommunity } from "./community/queries";

/**
 * Entrepreneurs start at their business, the P2P desk at its desk, capital
 * providers at the portfolio, a leader inside her community, auditors at the
 * audit console, admins at the communities.
 */
export default function HomeRedirect() {
  const { profile } = useAuth();
  const led = useLedCommunity();
  if (profile?.role === "community_leader" && led.isPending) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;
  const home =
    profile?.role === "community_leader" && led.data ? `/app/community/${led.data.id}` :
    profile?.role === "entrepreneur" ? "/app/me"
    : profile?.role === "partner" ? "/app/partner"
    : profile?.role === "capital_provider" ? "/app/investor"
    : profile?.role === "auditor" ? "/app/audit"
    : "/app/community";
  return <Navigate to={home} replace />;
}
