import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, LogOut, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { addDays, diaryErrorText } from "../diary/diary";
import { diaryClosed, diaryDb, useDiarySession } from "../diary/db";
import SignIn from "../diary/SignIn";
import Dashboard from "./Dashboard";
import { type Campaign, ddmm, impacto } from "./impacto";

/**
 * /impacto -- the reserved impact area: real figures from the diary, in the
 * app's production database, for EmpowerFI's team (every campaign) and the
 * people each sponsor names (its own campaigns). Access is decided by the
 * database, from the signed-in address; this page only asks.
 */
export default function ImpactoApp() {
  return (
    <LocaleProvider>
      <div className="min-h-dvh bg-background text-foreground">
        {diaryClosed ? (
          <main className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
            {tr({ en: "The impact area is not open here yet.", pt: "A área de impacto ainda não está aberta aqui." })}
          </main>
        ) : (
          <Routes>
            <Route path="entrar" element={
              <SignIn home="/impacto"
                title={tr({ en: "Impact area", pt: "Área de impacto" })}
                intro={tr({
                  en: "For sponsors and the EmpowerFI team. Use the e-mail EmpowerFI authorised; we send you a 6-digit code.",
                  pt: "Para patrocinadores e a equipe EmpowerFI. Use o e-mail que a EmpowerFI autorizou; enviamos um código de 6 números.",
                })} />
            } />
            <Route path="*" element={<Gate />} />
          </Routes>
        )}
      </div>
    </LocaleProvider>
  );
}

const waiting = (
  <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
    <Loader2 className="animate-spin" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
  </div>
);

function Gate() {
  const { session, loading } = useDiarySession();
  const location = useLocation();
  const campaigns = useQuery({
    queryKey: ["impacto", "campaigns", session?.user.id],
    enabled: Boolean(session),
    queryFn: impacto.campaigns,
  });

  if (loading) return waiting;
  if (!session) return <Navigate to={`/impacto/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (campaigns.isLoading) return waiting;
  if (campaigns.error) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <p className="text-muted-foreground">{diaryErrorText(campaigns.error)}</p>
        <Button onClick={() => void campaigns.refetch()}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
      </main>
    );
  }
  if (!campaigns.data?.length) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{tr({ en: "No access yet", pt: "Ainda sem acesso" })}</h1>
        <p className="text-muted-foreground">
          {tr({
            en: `${session.user.email} has no campaign to see. If you should, ask EmpowerFI to authorise this e-mail.`,
            pt: `${session.user.email} não tem nenhuma campanha para ver. Se deveria ter, peça à EmpowerFI para autorizar este e-mail.`,
          })}
        </p>
        <SignOut />
      </main>
    );
  }
  return <Area campaigns={campaigns.data} email={session.user.email ?? ""} />;
}

function SignOut() {
  return (
    <Button variant="outline" className="h-10" onClick={() => void diaryDb.auth.signOut()}>
      <LogOut aria-hidden="true" />
      {tr({ en: "Sign out", pt: "Sair" })}
    </Button>
  );
}

type Period = "all" | "30d";

function Area({ campaigns, email }: { campaigns: Campaign[]; email: string }) {
  const [params, setParams] = useSearchParams();
  const id = campaigns.some((c) => c.id === params.get("campanha")) ? params.get("campanha")! : campaigns[0].id;
  const [period, setPeriod] = useState<Period>("all");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const from = period === "30d" ? addDays(today, -29) : null;
  const live = useQuery({
    queryKey: ["impacto", "live", id, from],
    queryFn: () => impacto.live(id, from),
    refetchInterval: 5 * 60_000,
  });

  const download = () => {
    if (!live.data) return;
    const blob = new Blob([JSON.stringify(live.data, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `impacto-${live.data.campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${live.data.to}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const select = "h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <>
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="font-heading text-lg font-semibold">EmpowerFI · {tr({ en: "Impact", pt: "Impacto" })}</span>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground sm:inline">{email}</span>
            <LanguageSwitch />
            <SignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{tr({ en: "Campaign", pt: "Campanha" })}</span>
            <select className={`${select} min-w-[14rem]`} value={id}
              onChange={(e) => setParams((p) => { p.set("campanha", e.target.value); return p; }, { replace: true })}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.sponsor_name} ({ddmm(c.period_start)}{c.period_end ? ` – ${ddmm(c.period_end)}` : ""})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{tr({ en: "Period", pt: "Período" })}</span>
            <select className={select} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="all">{tr({ en: "Whole campaign", pt: "Campanha inteira" })}</option>
              <option value="30d">{tr({ en: "Last 30 days", pt: "Últimos 30 dias" })}</option>
            </select>
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="h-10" onClick={() => window.print()} disabled={!live.data}>
              <Printer aria-hidden="true" />{tr({ en: "Print / PDF", pt: "Imprimir / PDF" })}
            </Button>
            <Button variant="outline" className="h-10" onClick={download} disabled={!live.data}>
              <Download aria-hidden="true" />JSON
            </Button>
          </div>
        </div>

        {live.isLoading && waiting}
        {live.error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">{diaryErrorText(live.error)}</p>
            <Button variant="outline" onClick={() => void live.refetch()}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
          </div>
        )}
        {live.data && <Dashboard data={live.data} />}
      </main>
    </>
  );
}
