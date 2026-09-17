import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2, LogIn, PenLine, Wallet } from "lucide-react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataLegend from "../components/product/DataLegend";
import NetworkBadge from "../components/product/NetworkBadge";
import { useAuth } from "../auth/useAuth";
import { describeError } from "../lib/errors";
import { platformConfigured } from "../lib/platform";
import { DEMO_PASSWORD, OPERATIONS, STORIES } from "../lib/stories";
import { type Tool, toolPath, type View, viewById, VIEWS } from "../lib/views";
import RoleLanding, { ViewChoice } from "../components/views/RoleLanding";
import { shortAddress } from "../lib/solana";
import ConnectWalletDialog from "../wallet/ConnectWallet";
import { supportsSolanaSignIn, useWalletSignInWithMessage, useWalletSignInWithSolana } from "../wallet/useWalletSignIn";
import { prototypeNotice } from "../lib/capital";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";

/**
 * After a wallet connects: one signature, and the investor is in. It opens as a
 * dialog in the middle of the screen and asks the wallet to sign straight away,
 * so the step can't be missed below the fold; if the wallet refuses or fails,
 * the reason and a retry stay in the same place.
 */
type WalletSignInProps = { account: UiWalletAccount; onDone: () => void; onCancel: () => void };

function WalletSignIn(props: WalletSignInProps) {
  return supportsSolanaSignIn(props.account) ? <SignInWithSolana {...props} /> : <SignInWithMessage {...props} />;
}

function SignInWithSolana(props: WalletSignInProps) {
  return <WalletSignInDialog {...props} signIn={useWalletSignInWithSolana(props.account)} />;
}

function SignInWithMessage(props: WalletSignInProps) {
  return <WalletSignInDialog {...props} signIn={useWalletSignInWithMessage(props.account)} />;
}

function WalletSignInDialog({ account, onDone, onCancel, signIn }: WalletSignInProps & { signIn: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const sign = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
      onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }, [signIn, onDone]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void sign();
  }, [sign]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {tr({ en: `Sign in with ${shortAddress(account.address)}`, pt: `Entrar com ${shortAddress(account.address)}` })}
          </DialogTitle>
          <DialogDescription>
            {tr({
              en: "Your wallet asks you to sign a message proving you hold this address. No transaction, no fee.",
              pt: "Sua carteira pede que você assine uma mensagem provando que controla este endereço. Sem transação, sem taxa.",
            })}
          </DialogDescription>
        </DialogHeader>
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 size={16} className="animate-spin" />
            {tr({ en: "Waiting for your wallet… check its window to approve.", pt: "Aguardando sua carteira… confira a janela dela para aprovar." })}
          </p>
        )}
        {error && <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} className="gap-2" onClick={() => void sign()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
            {error ? tr({ en: "Try again", pt: "Tentar de novo" }) : tr({ en: "Sign the message", pt: "Assinar a mensagem" })}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";
  const view = viewById(params.get("as")) ?? VIEWS[0];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyTool, setBusyTool] = useState<Tool | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState<UiWalletAccount | null>(null);

  if (session) return <Navigate to={next} replace />;

  const enter = async (address: string, secret: string, to: string = next) => {
    setBusy(address + to);
    setError(null);
    const { error } = await signIn(address.trim(), secret);
    setBusy(null);
    if (error) setError(error === "Invalid login credentials" ? tr({ en: "Wrong email or password.", pt: "E-mail ou senha incorretos." }) : error);
    else navigate(to, { replace: true });
  };
  // A view opens at the tool chosen, unless the visitor was sent here from a page.
  const openTool = async (tool: Tool) => {
    setBusyTool(tool);
    await enter(view.persona.email, DEMO_PASSWORD, next === "/app" ? toolPath(tool, null) : next);
    setBusyTool(null);
  };
  const choose = (id: View["id"]) => {
    const p = new URLSearchParams(params);
    p.set("as", id);
    setParams(p, { replace: true });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enter(email, password);
  };
  const investor = view.id === "investor";
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
          <RoleLanding view={view} onTool={(tool) => void openTool(tool)} busy={busyTool}
            cta={
              <>
                {investor && (
                  <Button size="lg" onClick={() => setConnecting(true)} className="gap-2">
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

        {account && (
          <WalletSignIn account={account} onCancel={() => setAccount(null)}
            onDone={() => navigate(next === "/app" ? "/app/investor" : next, { replace: true })} />
        )}

        <section className="space-y-4" aria-labelledby="stories-heading">
          <div className="space-y-1">
            <h2 id="stories-heading" className="font-heading text-xl font-bold text-foreground">{tr({ en: "One loop, three stories", pt: "Um ciclo, três histórias" })}</h2>
            <p className="text-sm text-muted-foreground">{tr({
              en: "The demo follows one opportunity: sponsor evidence → credit intelligence → qualified opportunity → capital → repayment → outcome. The bar at the top of the platform switches demo accounts in one click.",
              pt: "A demonstração segue uma oportunidade: evidência do patrocinador → inteligência de crédito → oportunidade qualificada → capital → pagamento → resultado. A barra no topo da plataforma troca de conta demo em um clique.",
            })}</p>
          </div>
          <ol className="grid gap-3 md:grid-cols-3">
            {STORIES.map((area, i) => {
              const Icon = area.icon;
              return (
                <li key={area.id}>
                  <button type="button" onClick={() => enter(area.persona.email, DEMO_PASSWORD, next === "/app" ? area.to : next)} disabled={busy !== null}
                    aria-label={tr({ en: `Enter ${area.label}`, pt: `Entrar em ${area.label}` })}
                    className="panel flex h-full w-full items-start gap-3 p-4 text-left transition-colors hover:border-accent/50 disabled:opacity-60">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                        <span className="flex items-center gap-2"><Icon size={15} className="text-accent" aria-hidden /> {area.label}</span>
                        {busy?.startsWith(area.persona.email) ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} className="text-muted-foreground" />}
                      </span>
                      <span className="block text-xs text-muted-foreground">{area.audience}</span>
                      <span className="block text-[11px] text-muted-foreground">{tr({ en: `Demo account: ${area.persona.name}`, pt: `Conta demo: ${area.persona.name}` })}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>{tr({ en: "Oversight:", pt: "Supervisão:" })}</span>
            {oversight.map((area) => (
              <button key={area.id} type="button" onClick={() => enter(area.persona.email, DEMO_PASSWORD, next === "/app" ? area.to : next)} disabled={busy !== null}
                title={area.audience} className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-60">
                <area.icon size={14} className="text-accent" aria-hidden /> {area.label}
              </button>
            ))}
          </p>
        </section>

        <ConnectWalletDialog open={connecting} onOpenChange={setConnecting}
          onConnected={(a) => { setConnecting(false); setAccount(a); }} />

        <details className="panel max-w-xl p-5">
          <summary className="cursor-pointer text-sm font-medium text-foreground">{tr({ en: "Sign in with email", pt: "Entrar com e-mail" })}</summary>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">{tr({ en: "Email", pt: "E-mail" })}</Label>
              <Input id="login-email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">{tr({ en: "Password", pt: "Senha" })}</Label>
              <Input id="login-password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy !== null} className="w-full gap-2">
              {busy === email + next ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} {tr({ en: "Sign in", pt: "Entrar" })}
            </Button>
            <p className="text-xs text-muted-foreground">
              {tr({
                en: <>Demo accounts use the password <code className="text-foreground">{DEMO_PASSWORD}</code>.</>,
                pt: <>As contas de demonstração usam a senha <code className="text-foreground">{DEMO_PASSWORD}</code>.</>,
              })}
            </p>
          </form>
        </details>
      </main>
    </div>
  );
}
