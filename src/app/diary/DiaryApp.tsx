import { lazy, Suspense } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, Loader2, PenLine } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import { Button } from "@/components/ui/button";
import { diary, diaryErrorText, PROFILE_KEY } from "./diary";
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
  return (
    <div className="min-h-dvh bg-background text-foreground">
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
  const { session, loading } = useAuth();
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
  if (!profile.data.enrolled) return <Enrol />;
  return <Layout name={profile.data.name ?? ""} />;
}

function Layout({ name }: { name: string }) {
  const tab = (to: string, label: string, Icon: typeof PenLine, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isActive ? "font-semibold text-primary" : "text-muted-foreground"
        }`}
    >
      <Icon size={20} aria-hidden="true" />
      {label}
    </NavLink>
  );
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <span className="font-heading text-lg font-semibold">EmpowerFI</span>
          <div className="flex items-center gap-3">
            <span className="max-w-[10rem] truncate text-sm text-muted-foreground">{name}</span>
            <LanguageSwitch />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <nav
        aria-label={tr({ en: "Diary", pt: "Diário" })}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-md">
          {tab("/app/diario", tr({ en: "Today", pt: "Hoje" }), PenLine, true)}
          {tab("/app/diario/historico", tr({ en: "History", pt: "Histórico" }), BookOpen)}
          {tab("/app/diario/lembretes", tr({ en: "Reminders", pt: "Lembretes" }), Bell)}
        </div>
      </nav>
    </>
  );
}
