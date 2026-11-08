import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, Loader2, PenLine, RefreshCw } from "lucide-react";
import { tr } from "../i18n";
import { Button } from "@/components/ui/button";
import { diaryClosed, useDiarySession } from "./db";
import { diary, diaryErrorText, type DiaryProfile, markTourSeen, PROFILE_KEY, tourSeen } from "./diary";
import { Tour } from "./Tour";
import { TOUR, TourContext } from "./tour-steps";
import { useDiaryUpdate } from "./update";
import { Avatar, DiaryLogo } from "./Brand";
import SponsorLogo from "./SponsorLogo";
import { resyncPush } from "./push";
import { useDiaryPwa } from "./pwa";
import SignIn from "./SignIn";

const Enrol = lazy(() => import("./Enrol"));
const Today = lazy(() => import("./Today"));
const History = lazy(() => import("./History"));
const Reminders = lazy(() => import("./Reminders"));

const waiting = (
  <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
    <Loader2 className="animate-spin" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
  </div>
);

/**
 * The entrepreneur's diary, mobile first, outside the platform's layout:
 * /app/diario (today), /app/diario/historico, /app/diario/lembretes, and
 * /app/diario/entrar to sign in with a code sent by e-mail.
 */
export default function DiaryApp() {
  useDiaryPwa(!diaryClosed);
  if (diaryClosed) {
    return (
      <main className="mx-auto max-w-md space-y-2 px-4 py-16 text-center">
        <DiaryLogo size="lg" />
        <p className="text-muted-foreground">
          {tr({ en: "The diary is not open here yet.", pt: "O diário ainda não está aberto aqui." })}
        </p>
      </main>
    );
  }
  return (
    <div className="diary min-h-dvh bg-background text-foreground">
      <Suspense fallback={waiting}>
        <Routes>
          <Route path="entrar" element={<SignIn />} />
          <Route element={<Gate />}>
            <Route index element={<Today />} />
            <Route path="historico" element={<History />} />
            <Route path="lembretes" element={<Reminders />} />
            <Route path="*" element={<Navigate to="/app/diario" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}

/** Signed in, then enrolled, then the diary. */
function Gate() {
  const { session, loading } = useDiarySession();
  const location = useLocation();
  const profile = useQuery({
    queryKey: [...PROFILE_KEY, session?.user.id],
    enabled: Boolean(session),
    queryFn: diary.profile,
  });

  if (loading) return waiting;
  if (!session) {
    return <Navigate to={`/app/diario/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (profile.isLoading) return waiting;
  if (profile.error || !profile.data) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <p className="text-muted-foreground">{diaryErrorText(profile.error)}</p>
        <Button onClick={() => void profile.refetch()}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
      </main>
    );
  }
  if (!profile.data.enrolled) return <Enrol fromApp={profile.data.from_app ?? null} />;
  return <Layout name={profile.data.name ?? ""} campaign={profile.data.campaign ?? null} userId={session.user.id} />;
}

function Layout({ name, campaign, userId }: { name: string; campaign: DiaryProfile["campaign"]; userId: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The guided tour: once for whoever starts, on Hoje; again from Lembretes.
  const [touring, setTouring] = useState(false);
  const tour = useMemo(() => ({ start: () => setTouring(true) }), []);
  useEffect(() => {
    if (pathname === "/app/diario" && !tourSeen(userId)) setTouring(true);
  }, [pathname, userId]);
  const update = useDiaryUpdate();
  const endTour = () => {
    markTourSeen(userId);
    setTouring(false);
  };
  useEffect(() => {
    void resyncPush();
    // A tapped notification, while the diary was already open: the worker asks the page to go there.
    const onMessage = (e: MessageEvent) => {
      const url = (e.data as { type?: string; url?: string } | null)?.type === "open" ? e.data.url : null;
      if (typeof url !== "string") return;
      const target = new URL(url, location.origin);
      if (target.origin === location.origin && target.pathname.startsWith("/app/diario")) navigate(target.pathname + target.search);
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [navigate]);
  const tab = (to: string, label: string, Icon: typeof PenLine, end = false, tourName?: string) => (
    <NavLink
      to={to}
      end={end}
      data-tour={tourName}
      className={({ isActive }) =>
        `group flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
          isActive ? "font-semibold text-foreground" : "text-muted-foreground"
        }`}
    >
      {({ isActive }) => (
        <>
          <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? "bg-secondary" : ""}`}>
            <Icon size={18} aria-hidden="true" />
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
  return (
    <TourContext.Provider value={tour}>
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 px-4">
          <DiaryLogo />
          <div className="flex min-w-0 items-center gap-3">
            {campaign && !campaign.is_default && campaign.logo_path && (
              <SponsorLogo sponsor={campaign.sponsor_name} logoPath={campaign.logo_path} linkUrl={campaign.link_url} />
            )}
            {/* With a sponsor's logo there is no room for her name on a phone. */}
            <span className={`max-w-[8rem] truncate text-sm ${campaign?.logo_path && !campaign.is_default ? "hidden sm:inline" : ""}`}>{name}</span>
            <Avatar name={name} />
          </div>
        </div>
      </header>
      <div aria-live="polite">
        {update.ready && (
          <div className="border-b border-border bg-secondary">
            <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2">
              <p className="flex items-center gap-2 text-sm">
                <RefreshCw size={16} aria-hidden="true" />
                {tr({ en: "A new version of the diary is ready.", pt: "Tem uma versão nova do diário." })}
              </p>
              <Button size="sm" className="h-10 shrink-0" onClick={update.apply}>{tr({ en: "Update", pt: "Atualizar" })}</Button>
            </div>
          </div>
        )}
      </div>
      <main className="mx-auto max-w-md px-4 pb-24 pt-3">
        <Outlet />
      </main>
      <nav
        aria-label="EmpowerFI Diário"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-md">
          {tab("/app/diario", tr({ en: "Today", pt: "Hoje" }), PenLine, true)}
          {tab("/app/diario/historico", tr({ en: "History", pt: "Histórico" }), BookOpen, false, "tab-history")}
          {tab("/app/diario/lembretes", tr({ en: "Reminders", pt: "Lembretes" }), Bell)}
        </div>
      </nav>
      {touring && <Tour steps={TOUR} onClose={endTour} />}
    </TourContext.Provider>
  );
}
