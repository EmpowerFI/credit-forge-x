import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./AppLayout";
import { AuthProvider } from "./auth/AuthProvider";
import RequireAuth from "./auth/RequireAuth";
import AdminReviewPage from "./pages/AdminReviewPage";
import CommunitiesPage from "./pages/CommunitiesPage";
import CommunityDetailPage from "./pages/CommunityDetailPage";
import LoginPage from "./pages/LoginPage";
import NewCommunityPage from "./pages/NewCommunityPage";

// The Solana client is heavy and only the audit screen needs it in the browser.
const AuditPage = lazy(() => import("./pages/AuditPage"));

/**
 * The restricted area (/app/*): communities, readiness, partner and capital
 * dashboards, and the audit trail. Loaded lazily from App.tsx so none of it
 * weighs on the marketing site.
 */
export default function PlatformApp() {
  useEffect(() => {
    document.title = "EmpowerFI Platform";
    // Nothing here is for search engines.
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Navigate to="community" replace />} />
          <Route path="community" element={<CommunitiesPage />} />
          <Route path="community/new"
            element={<RequireAuth roles={["community_leader", "admin"]}><NewCommunityPage /></RequireAuth>} />
          <Route path="community/:id" element={<CommunityDetailPage />} />
          {/* Anyone signed in may open one; audit_record decides what they may see. */}
          <Route path="audit/:kind/:entityId" element={<Suspense fallback={null}><AuditPage /></Suspense>} />
          <Route path="admin" element={<RequireAuth roles={["admin"]}><AdminReviewPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
