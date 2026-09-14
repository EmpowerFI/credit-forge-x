import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

/** Entrepreneurs start at their business; everyone else at the communities. */
export default function HomeRedirect() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === "entrepreneur" ? "/app/me" : "/app/community"} replace />;
}
