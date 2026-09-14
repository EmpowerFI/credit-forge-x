import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

/** Entrepreneurs start at their business, partners at their desk, everyone else at the communities. */
export default function HomeRedirect() {
  const { profile } = useAuth();
  const home = profile?.role === "entrepreneur" ? "/app/me" : profile?.role === "partner" ? "/app/partner" : "/app/community";
  return <Navigate to={home} replace />;
}
