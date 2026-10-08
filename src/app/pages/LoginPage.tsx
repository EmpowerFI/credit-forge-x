import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataLegend from "../components/product/DataLegend";
import NetworkBadge from "../components/product/NetworkBadge";
import { useAuth } from "../auth/useAuth";
import { platformConfigured } from "../lib/platform";
import { areaOf, DEMO_PASSWORD, OPERATIONS } from "../lib/stories";
import { offeredView, roleOpensPath, type Tool, toolPath, type View, VIEWS } from "../lib/views";
import RoleLanding, { ViewChoice } from "../components/views/RoleLanding";
import { useWalletEntry } from "../wallet/WalletSignIn";
import { prototypeNotice } from "../lib/capital";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";
  const view = offeredView(params.get("as")) ?? VIEWS[0];

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyTool, setBusyTool] = useState<Tool | null>(null);
  /**
   * Where entering should land. `next` is the page the visitor was sent here
   * from — but they choose who to enter as, and that choice may not open it.
   * Following `next` regardless signs someone in as one persona and drops them
   * on another's page, which RBAC then refuses: a dead end one click in. So
   * `next` is honoured only when this entry opens it, and otherwise the entry
   * goes to its own home.
   */
  const landing = (home: string, opensNext: boolean) => (next !== "/app" && opensNext ? next : home);

  const entry = useWalletEntry(() =>
    navigate(landing("/app/investor", roleOpensPath(next, "capital_provider")), { replace: true }));

  if (session) return <Navigate to={next} replace />;

  const enter = async (address: string, secret: string, to: string = next) => {
    setBusy(address + to);
    setError(null);
    const { error } = await signIn(address.trim(), secret);
    setBusy(null);
    if (error) setError(error === "Invalid login credentials" ? tr({ en: "Wrong email or password.", pt: "E-mail ou senha incorretos." }) : error);
    else navigate(to, { replace: true });
  };
  // A view opens at the tool chosen; `next` wins only where this view's
  // persona can follow it.
  const openTool = async (tool: Tool) => {
    setBusyTool(tool);
    await enter(view.persona.email, DEMO_PASSWORD,
      landing(toolPath(tool, null), roleOpensPath(next, view.persona.role)));
    setBusyTool(null);
  };
  const choose = (id: View["id"]) => {
    const p = new URLSearchParams(params);
    p.set("as", id);
    setParams(p, { replace: true });
  };
  const investor = view.id === "investor";
  // Admin and the audit console, and only those two. The P2P desk spent an hour
  // here on 8 Oct, on the reasoning that this line is where an area in no view
  // belongs — which is true of the shape and false of the product. The desk has
  // no use in the MVP, and a door in a footer is still a door. Nothing in the
  // interface becomes the desk now; its routes answer to oversight, which is
  // what admin is for.
  const oversight = OPERATIONS.filter((a) => a.id === "admin" || a.id === "audit");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-caution/35 px-2.5 py-1 text-xs font-medium text-caution sm:inline">
              {tr({ en: "Simulated data", pt: "Dados simulados" })}
            </span>
            <LanguageSwitch />
            <NetworkBadge />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 md:py-14">
        {!platformConfigured && (
          <p className="rounded-lg border tone-alert p-3 text-sm">
            {tr({
              en: "The platform is not configured in this build (VITE_PLATFORM_SUPABASE_*).",
              pt: "A plataforma não está configurada nesta build (VITE_PLATFORM_SUPABASE_*).",
            })}
          </p>
        )}

        <div className="space-y-8">
          <ViewChoice value={view.id} onChange={choose} />
          {error && <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>}
          <RoleLanding view={view}
            cta={
              <>
                {investor && (
                  <Button size="lg" onClick={entry.start} disabled={entry.busy} className="gap-2">
                    <Wallet size={16} /> {tr({ en: "Connect wallet", pt: "Conectar carteira" })}
                  </Button>
                )}
                <Button size="lg" variant={investor ? "secondary" : "default"} className="gap-2" disabled={busy !== null}
                  onClick={() => void openTool(view.home)}>
                  {investor
                    ? tr({ en: "Explore without a wallet", pt: "Explorar sem carteira" })
                    : tr({ en: `Enter as demo · ${view.persona.name}`, pt: `Entrar como demo · ${view.persona.name}` })}
                  {busyTool === view.home ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                </Button>
              </>
            } />
          <div className="max-w-3xl space-y-3">
            <p className="rounded-xl border tone-caution px-4 py-3 text-sm">{prototypeNotice()}</p>
            <DataLegend />
          </div>
        </div>

        {entry.dialogs}

        {/* Admin and the audit console are in none of the views above, so this
            line is the only way in to them. The three story cards that used to
            sit here opened views the chips already open. */}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>{tr({ en: "Oversight:", pt: "Supervisão:" })}</span>
          {oversight.map((area) => (
            <button key={area.id} type="button" onClick={() => enter(area.persona.email, DEMO_PASSWORD, landing(area.to, areaOf(next)?.id === area.id))} disabled={busy !== null}
              title={area.audience} className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-60">
              <area.icon size={14} className="text-accent" aria-hidden /> {area.label}
            </button>
          ))}
        </p>

      </main>
    </div>
  );
}
