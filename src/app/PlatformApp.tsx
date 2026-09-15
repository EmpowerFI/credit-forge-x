import { lazy, Suspense, useLayoutEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./AppLayout";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./auth/AuthProvider";
import RequireAuth from "./auth/RequireAuth";
import AdminReviewPage from "./pages/AdminReviewPage";
import CapitalPage from "./pages/CapitalPage";
import CheckinPage from "./pages/CheckinPage";
import CommunitiesPage from "./pages/CommunitiesPage";
import HomeRedirect from "./pages/HomeRedirect";
import LoginPage from "./pages/LoginPage";
import MePage from "./pages/MePage";
import NewCommunityPage from "./pages/NewCommunityPage";
import PartnerPage from "./pages/PartnerPage";
import type { Role } from "./lib/platform";
import WalletProvider from "./wallet/WalletProvider";

// The Solana client is heavy and only the audit screens need it in the browser.
const AuditPage = lazy(() => import("./pages/AuditPage"));
const AuditLayout = lazy(() => import("./pages/audit/AuditLayout"));
const AuditAttestations = lazy(() => import("./pages/audit/Attestations"));
const AuditEvents = lazy(() => import("./pages/audit/Events"));
const AuditModels = lazy(() => import("./pages/audit/Models"));
const AuditConsents = lazy(() => import("./pages/audit/Consents"));
const AuditSystem = lazy(() => import("./pages/audit/System"));
const AuditZcash = lazy(() => import("./pages/audit/Zcash"));
const ConsentPage = lazy(() => import("./pages/ConsentPage"));
// The investor console: wallet, Solana client and charts, loaded when opened.
const InvestorOverview = lazy(() => import("./pages/investor/Overview"));
const InvestorOpportunities = lazy(() => import("./pages/investor/Opportunities"));
const OpportunityDetail = lazy(() => import("./pages/investor/OpportunityDetail"));
const InvestorPortfolio = lazy(() => import("./pages/investor/Portfolio"));
const InvestorPosition = lazy(() => import("./pages/investor/Position"));
const InvestorAuditTrail = lazy(() => import("./pages/investor/AuditTrail"));
const InvestorSettlement = lazy(() => import("./pages/investor/Settlement"));

// Community Intelligence, loaded when a community is opened.
const CommunityLayout = lazy(() => import("./pages/community/CommunityLayout"));
const CommunityOverview = lazy(() => import("./pages/community/Overview"));
const CommunityCohorts = lazy(() => import("./pages/community/Cohorts"));
const CommunityParticipants = lazy(() => import("./pages/community/Participants"));
const CommunityParticipant = lazy(() => import("./pages/community/Participant"));
const CommunityReadiness = lazy(() => import("./pages/community/Readiness"));
const CommunityPipeline = lazy(() => import("./pages/community/Pipeline"));
const CommunityImpact = lazy(() => import("./pages/community/Impact"));
const loading = <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;

const INVESTOR_ROLES: Role[] = ["capital_provider", "admin", "auditor"];
const investor = (page: React.ReactNode) => (
  <RequireAuth roles={INVESTOR_ROLES}>
    <Suspense fallback={<Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />}>{page}</Suspense>
  </RequireAuth>
);

/**
 * The restricted area (/app/*): communities, readiness, partner and capital
 * dashboards, and the audit trail. Loaded lazily from App.tsx so none of it
 * weighs on the marketing site.
 */
export default function PlatformApp() {
  useLayoutEffect(() => {
    document.title = "EmpowerFI Platform";
    // Nothing here is for search engines.
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    // The product's dark theme, on <html> so dialogs and toasts follow it —
    // before the first paint, so entering from the light site does not flash.
    document.documentElement.classList.add("dark");
    return () => {
      robots.remove();
      document.documentElement.classList.remove("dark");
    };
  }, []);

  return (
    <AuthProvider>
      <WalletProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<HomeRedirect />} />
          <Route path="me" element={<MePage />} />
          <Route path="check-in" element={<CheckinPage />} />
          <Route path="consent" element={<Suspense fallback={loading}><ConsentPage /></Suspense>} />
          <Route path="community" element={<CommunitiesPage />} />
          <Route path="community/new"
            element={<RequireAuth roles={["community_leader", "admin"]}><NewCommunityPage /></RequireAuth>} />
          <Route path="community/:id" element={<Suspense fallback={loading}><CommunityLayout /></Suspense>}>
            <Route index element={<Suspense fallback={loading}><CommunityOverview /></Suspense>} />
            <Route path="cohorts" element={<Suspense fallback={loading}><CommunityCohorts /></Suspense>} />
            <Route path="participants" element={<Suspense fallback={loading}><CommunityParticipants /></Suspense>} />
            <Route path="participants/:entrepreneurId" element={<Suspense fallback={loading}><CommunityParticipant /></Suspense>} />
            <Route path="readiness" element={<Suspense fallback={loading}><CommunityReadiness /></Suspense>} />
            <Route path="pipeline" element={<Suspense fallback={loading}><CommunityPipeline /></Suspense>} />
            <Route path="impact" element={<Suspense fallback={loading}><CommunityImpact /></Suspense>} />
          </Route>
          <Route path="audit" element={<RequireAuth roles={["auditor", "admin"]}><Suspense fallback={loading}><AuditLayout /></Suspense></RequireAuth>}>
            <Route index element={<Suspense fallback={loading}><AuditAttestations /></Suspense>} />
            <Route path="events" element={<Suspense fallback={loading}><AuditEvents /></Suspense>} />
            <Route path="models" element={<Suspense fallback={loading}><AuditModels /></Suspense>} />
            <Route path="consents" element={<Suspense fallback={loading}><AuditConsents /></Suspense>} />
            <Route path="zcash" element={<Suspense fallback={loading}><AuditZcash /></Suspense>} />
            <Route path="system" element={<Suspense fallback={loading}><AuditSystem /></Suspense>} />
          </Route>
          {/* Anyone signed in may open one; audit_record decides what they may see. */}
          <Route path="audit/:kind/:entityId" element={<Suspense fallback={null}><AuditPage /></Suspense>} />
          <Route path="partner" element={<RequireAuth roles={["partner", "admin", "auditor"]}><PartnerPage /></RequireAuth>} />
          <Route path="investor" element={investor(<InvestorOverview />)} />
          <Route path="investor/opportunities" element={investor(<InvestorOpportunities />)} />
          <Route path="investor/opportunities/:id" element={investor(<OpportunityDetail />)} />
          <Route path="investor/portfolio" element={investor(<InvestorPortfolio />)} />
          <Route path="investor/positions/:id" element={investor(<InvestorPosition />)} />
          <Route path="investor/settlement" element={investor(<InvestorSettlement />)} />
          <Route path="investor/audit" element={investor(<InvestorAuditTrail />)} />
          <Route path="capital" element={<RequireAuth roles={["capital_provider", "admin", "auditor"]}><CapitalPage /></RequireAuth>} />
          <Route path="admin" element={<RequireAuth roles={["admin"]}><AdminReviewPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Routes>
      </WalletProvider>
    </AuthProvider>
  );
}
