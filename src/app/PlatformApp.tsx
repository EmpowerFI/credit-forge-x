import { lazy, Suspense, useLayoutEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./AppLayout";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./auth/AuthProvider";
import RequireAuth from "./auth/RequireAuth";
import AdminReviewPage from "./pages/AdminReviewPage";
import CheckinPage from "./pages/CheckinPage";
import CommunitiesPage from "./pages/CommunitiesPage";
import HomeRedirect from "./pages/HomeRedirect";
import LoginPage from "./pages/LoginPage";
import MePage from "./pages/MePage";
import NewCommunityPage from "./pages/NewCommunityPage";
import type { Role } from "./lib/platform";
import WalletProvider from "./wallet/WalletProvider";
import { tr } from "./i18n";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { useLocale } from "./i18n/useLocale";

// The Solana client is heavy and only the audit screens need it in the browser.
const AuditPage = lazy(() => import("./pages/AuditPage"));
const AllocationEngine = lazy(() => import("./pages/capital/AllocationEngine"));
const CapitalNetwork = lazy(() => import("./pages/capital/network/CapitalNetwork"));
const LocalEconomy = lazy(() => import("./pages/capital/local/LocalEconomy"));
const CapitalJourney = lazy(() => import("./pages/capital/journey/CapitalJourney"));
const AuditLayout = lazy(() => import("./pages/audit/AuditLayout"));
const AuditAttestations = lazy(() => import("./pages/audit/Attestations"));
const AuditEvents = lazy(() => import("./pages/audit/Events"));
const AuditModels = lazy(() => import("./pages/audit/Models"));
const AuditConsents = lazy(() => import("./pages/audit/Consents"));
const AuditSystem = lazy(() => import("./pages/audit/System"));
const AuditZcash = lazy(() => import("./pages/audit/Zcash"));
const AuditReports = lazy(() => import("./pages/audit/Reports"));
// A shared audit report opens without an account.
const ReportPage = lazy(() => import("./pages/ReportPage"));
const ConsentPage = lazy(() => import("./pages/ConsentPage"));
const EvidencePage = lazy(() => import("./pages/EvidencePage"));
// The investor console: wallet, Solana client and charts, loaded when opened.
const InvestorOverview = lazy(() => import("./pages/investor/Overview"));
const InvestorOpportunities = lazy(() => import("./pages/investor/Opportunities"));
const OpportunityDetail = lazy(() => import("./pages/investor/OpportunityDetail"));
const InvestorPortfolio = lazy(() => import("./pages/investor/Portfolio"));
const InvestorPosition = lazy(() => import("./pages/investor/Position"));
const InvestorAuditTrail = lazy(() => import("./pages/investor/AuditTrail"));
const InvestorSettlement = lazy(() => import("./pages/investor/Settlement"));
const InvestorPositions = lazy(() => import("./pages/investor/Positions"));
const InvestorAsset = lazy(() => import("./pages/investor/PositionAsset"));

// EmpowerFI's P2P desk (the partner role in the database).
const PartnerLayout = lazy(() => import("./pages/partner/PartnerLayout"));
const PartnerPipeline = lazy(() => import("./pages/partner/Pipeline"));
const PartnerReviews = lazy(() => import("./pages/partner/Reviews"));
const PartnerDecisions = lazy(() => import("./pages/partner/Decisions"));
const PartnerPortfolio = lazy(() => import("./pages/partner/Portfolio"));
const PartnerServicing = lazy(() => import("./pages/partner/Servicing"));
const PartnerLoan = lazy(() => import("./pages/partner/Loan"));

// Community Intelligence, loaded when a community is opened.
const CommunityLayout = lazy(() => import("./pages/community/CommunityLayout"));
const CommunityOverview = lazy(() => import("./pages/community/Overview"));
const CommunityCohorts = lazy(() => import("./pages/community/Cohorts"));
const CommunityParticipants = lazy(() => import("./pages/community/Participants"));
const CommunityParticipant = lazy(() => import("./pages/community/Participant"));
const CommunityReadiness = lazy(() => import("./pages/community/Readiness"));
const CommunityPipeline = lazy(() => import("./pages/community/Pipeline"));
const CommunityImpact = lazy(() => import("./pages/community/Impact"));
const ImpactIntelligence = lazy(() => import("./pages/impact/ImpactIntelligence"));
const OperatingEconomics = lazy(() => import("./pages/capital/OperatingEconomics"));
const StartPage = lazy(() => import("./pages/StartPage"));
const Loading = () => <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;
const loading = <Loading />;

const INVESTOR_ROLES: Role[] = ["capital_provider", "admin", "auditor"];
const investor = (page: React.ReactNode) => (
  <RequireAuth roles={INVESTOR_ROLES}>
    <Suspense fallback={loading}>{page}</Suspense>
  </RequireAuth>
);

/**
 * The restricted area (/app/*): communities, readiness, partner and capital
 * dashboards, and the audit trail. Loaded lazily from App.tsx so none of it
 * weighs on the marketing site.
 */
export default function PlatformApp() {
  useLayoutEffect(() => {
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
    <LocaleProvider>
      <AuthProvider>
        <WalletProvider>
          <Pages />
        </WalletProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}

/** Keyed on the language, so switching it re-renders every page's text. */
function Pages() {
  const { locale } = useLocale();
  useLayoutEffect(() => {
    document.title = tr({ en: "EmpowerFI Platform", pt: "Plataforma EmpowerFI" });
  }, [locale]);
  return (
    <Routes key={locale}>
      <Route path="login" element={<LoginPage />} />
      <Route path="report/:token" element={<Suspense fallback={null}><ReportPage /></Suspense>} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<HomeRedirect />} />
        <Route path="start" element={<Suspense fallback={loading}><StartPage /></Suspense>} />
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
          <Route path="reports" element={<Suspense fallback={loading}><AuditReports /></Suspense>} />
        </Route>
        {/* Anyone signed in may open one; audit_record decides what they may see. */}
        <Route path="audit/:kind/:entityId" element={<Suspense fallback={null}><AuditPage /></Suspense>} />
        <Route path="partner" element={<RequireAuth roles={["partner", "admin", "auditor"]}><Suspense fallback={loading}><PartnerLayout /></Suspense></RequireAuth>}>
          <Route index element={<Suspense fallback={loading}><PartnerPipeline /></Suspense>} />
          <Route path="reviews" element={<Suspense fallback={loading}><PartnerReviews /></Suspense>} />
          <Route path="decisions" element={<Suspense fallback={loading}><PartnerDecisions /></Suspense>} />
          <Route path="portfolio" element={<Suspense fallback={loading}><PartnerPortfolio /></Suspense>} />
          <Route path="servicing" element={<Suspense fallback={loading}><PartnerServicing /></Suspense>} />
          <Route path="loans/:id" element={<Suspense fallback={loading}><PartnerLoan /></Suspense>} />
        </Route>
        <Route path="investor" element={investor(<InvestorOverview />)} />
        <Route path="investor/opportunities" element={investor(<InvestorOpportunities />)} />
        <Route path="investor/opportunities/:id" element={investor(<OpportunityDetail />)} />
        <Route path="investor/portfolio" element={investor(<InvestorPortfolio />)} />
        <Route path="investor/positions/:id" element={investor(<InvestorPosition />)} />
        <Route path="investor/settlement" element={investor(<InvestorSettlement />)} />
        {/* The asset, as distinct from the allocation that bought it. */}
        <Route path="investor/assets" element={investor(<InvestorPositions />)} />
        <Route path="investor/assets/:id" element={investor(<InvestorAsset />)} />
        <Route path="investor/audit" element={investor(<InvestorAuditTrail />)} />
        {/* What every number here is made of. Open to anyone signed in:
            whoever may read a figure may read what kind of claim it is. */}
        <Route path="evidence" element={<Suspense fallback={loading}><EvidencePage /></Suspense>} />
        <Route path="impact" element={<RequireAuth roles={["sponsor", "admin", "auditor"]}><Suspense fallback={loading}><ImpactIntelligence /></Suspense></RequireAuth>} />
        {/* The area opens on the whole loop, not on one of its tools. Every
            other screen here answers one movement well and none answered the
            question the product is for, which is why five good screens read as
            five unrelated ones. */}
        <Route path="capital" element={<RequireAuth roles={["sponsor", "capital_provider", "partner", "admin", "auditor"]}><Suspense fallback={loading}><CapitalJourney /></Suspense></RequireAuth>} />
        {/* Where the journey used to live. Links from outside the app outlive a
            reorganisation of it. */}
        <Route path="capital/journey" element={<Navigate to="/app/capital" replace />} />
        <Route path="capital/engine" element={<RequireAuth roles={["sponsor", "capital_provider", "partner", "admin", "auditor"]}><Suspense fallback={loading}><AllocationEngine /></Suspense></RequireAuth>} />
        {/* Reading the registry is as wide as its row-level policy; running the
            engine is for the desk and capital operators, and setting a policy is
            narrower still. The page gates those itself. */}
        <Route path="capital/network" element={<RequireAuth roles={["sponsor", "capital_provider", "partner", "admin", "auditor"]}><Suspense fallback={loading}><CapitalNetwork /></Suspense></RequireAuth>} />
        {/* What happened after the capital landed. The same reach as the rest
            of the engine's area; the reader itself checks each economy against
            the row-level policy, so a narrower account sees only its own. */}
        <Route path="capital/local" element={<RequireAuth roles={["sponsor", "capital_provider", "partner", "admin", "auditor"]}><Suspense fallback={loading}><LocalEconomy /></Suspense></RequireAuth>} />
        <Route path="capital/economics" element={<RequireAuth roles={["sponsor", "partner", "admin", "auditor"]}><Suspense fallback={loading}><OperatingEconomics /></Suspense></RequireAuth>} />
        <Route path="admin" element={<RequireAuth roles={["admin"]}><AdminReviewPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  );
}
