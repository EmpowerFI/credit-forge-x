import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import { Button } from "@/components/ui/button";
import { diaryClosed, useDiarySession } from "../diary/db";
import { diary, diaryErrorText, PROFILE_KEY } from "../diary/diary";
import { DiaryLogo } from "../diary/Brand";
import { seekerOpen } from "./config";
import { SeekerWallet } from "./SeekerWallet";
import { SeekerSpeak } from "./SeekerSpeak";
import { SeekerReserve } from "./SeekerReserve";

// The Seeker app (hackathon, 27–28/11/2026; PLAN_SEEKER.md). Its own route,
// /app/seeker, lazy-loaded: nothing here reaches the web diary's bundle
// (scripts/seeker-guard.ts fails the build if it would). It reads the
// diary's own database client, which on the Seeker deployment points at dev;
// on any other deployment VITE_SEEKER is unset and the route is closed.

const SignIn = lazy(() => import("../diary/SignIn"));

const HOME = "/app/seeker";

const waiting = (
  <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
    <Loader2 className="animate-spin" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
  </div>
);

export default function SeekerApp() {
  if (!seekerOpen || diaryClosed) {
    return (
      <main className="mx-auto max-w-md space-y-2 px-4 py-16 text-center">
        <DiaryLogo size="lg" />
        <p className="text-muted-foreground">
          {tr({ en: "The Seeker app is not available here.", pt: "O app Seeker não está disponível aqui." })}
        </p>
      </main>
    );
  }
  return (
    <div className="diary min-h-dvh bg-background text-foreground">
      <Suspense fallback={waiting}>
        <Routes>
          <Route path="entrar" element={<SignIn home={HOME} />} />
          <Route index element={<Gate />} />
          <Route path="*" element={<Navigate to={HOME} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

/** Signed in and enrolled, then the Seeker's home. Sign-up questions stay the diary's. */
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
    return <Navigate to={`${HOME}/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
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
  if (!profile.data.enrolled) return <Navigate to="/app/diario" replace />;
  return <Home name={profile.data.name ?? ""} userId={session.user.id} />;
}

function Home({ name, userId }: { name: string; userId: string }) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 px-4">
          <DiaryLogo />
          <LanguageSwitch variant="pill" />
        </div>
      </header>
      <main className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-5">
        <h1 className="font-heading text-2xl">
          {first ? tr({ en: `Hi, ${first}`, pt: `Oi, ${first}` }) : tr({ en: "Hi", pt: "Oi" })}
        </h1>
        <SeekerSpeak userId={userId} />
        <SeekerReserve />
        <SeekerWallet />
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">{tr({ en: "Your diary", pt: "Seu diário" })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr({ en: "Your days, history and reports, as on the web.", pt: "Seus dias, histórico e relatórios, como na web." })}
          </p>
          <Button asChild variant="outline" className="mt-3 h-11 w-full gap-2">
            <Link to="/app/diario">
              <BookOpen size={18} aria-hidden="true" />
              {tr({ en: "Open the diary", pt: "Abrir o diário" })}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>
    </>
  );
}
