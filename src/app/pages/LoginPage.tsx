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
import { type Area, DEMO_PASSWORD, OPERATIONS, STORIES } from "../lib/stories";
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
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
  // A story opens where it starts, unless the visitor was sent here from a page.
  const target = (area: Area) => (next === "/app" ? area.to : next);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enter(email, password);
  };

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

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 md:py-14">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">{tr({ en: "EmpowerFI platform", pt: "Plataforma EmpowerFI" })}</p>
          <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">{tr({ en: "Turn impact programs into investable businesses", pt: "Transforme programas de impacto em negócios investíveis" })}</h1>
          <p className="text-muted-foreground">
            {tr({
              en: "A sponsor funds a program, communities run it, the evidence qualifies credit, capital is routed and repaid, and the outcome returns to the sponsor, with every step proven on Solana and nothing personal on chain.",
              pt: "Um patrocinador financia um programa, as comunidades o conduzem, a evidência qualifica o crédito, o capital é roteado e pago, e o resultado volta ao patrocinador, com cada etapa provada na Solana e nada pessoal on-chain.",
            })}
          </p>
          <p className="rounded-xl border tone-caution px-4 py-3 text-sm">{prototypeNotice()}</p>
          <DataLegend />
        </div>

        {!platformConfigured && (
          <p className="rounded-lg border tone-alert p-3 text-sm">
            {tr({
              en: "The platform is not configured in this build (VITE_PLATFORM_SUPABASE_*).",
              pt: "A plataforma não está configurada nesta build (VITE_PLATFORM_SUPABASE_*).",
            })}
          </p>
        )}
        {error && <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>}

        {account && (
          <WalletSignIn account={account} onCancel={() => setAccount(null)}
            onDone={() => navigate(next === "/app" ? "/app/investor" : next, { replace: true })} />
        )}

        <section className="space-y-4" aria-labelledby="stories-heading">
          <div className="space-y-1">
            <h2 id="stories-heading" className="font-heading text-xl font-bold text-foreground">{tr({ en: "One loop, three stories", pt: "Um ciclo, três histórias" })}</h2>
            <p className="text-sm text-muted-foreground">{tr({
              en: "Sponsor evidence → credit intelligence → qualified opportunity → capital → repayment → outcome. Start with the first and move along the loop: the bar at the top switches demo accounts in one click.",
              pt: "Evidência do patrocinador → inteligência de crédito → oportunidade qualificada → capital → pagamento → resultado. Comece pela primeira e siga o ciclo: a barra no topo troca de conta demo em um clique.",
            })}</p>
          </div>
          <ol className="grid gap-4 lg:grid-cols-3">
            {STORIES.map((area, i) => {
              const Icon = area.icon;
              const investor = area.id === "investor";
              return (
                <li key={area.id} className="panel flex flex-col justify-between gap-5 p-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-accent"><Icon size={20} aria-hidden /></span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-heading text-lg font-bold text-foreground">{area.label}</h3>
                      <p className="text-sm text-muted-foreground">{area.audience}</p>
                      <p className="text-xs text-muted-foreground">{tr({ en: `Demo account: ${area.persona.name}`, pt: `Conta demo: ${area.persona.name}` })}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {investor && (
                      <Button onClick={() => setConnecting(true)} className="w-full justify-between">
                        <span>{tr({ en: "Connect wallet", pt: "Conectar carteira" })}</span> <Wallet size={16} />
                      </Button>
                    )}
                    <Button onClick={() => enter(area.persona.email, DEMO_PASSWORD, target(area))} disabled={busy !== null}
                      variant={investor ? "secondary" : "default"} className="w-full justify-between"
                      aria-label={tr({ en: `Enter ${area.label}`, pt: `Entrar em ${area.label}` })}>
                      <span>{investor ? tr({ en: "Explore without a wallet", pt: "Explorar sem carteira" }) : tr({ en: "Enter as demo", pt: "Entrar como demo" })}</span>
                      {busy === area.persona.email + target(area) ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-y-3" aria-labelledby="operations-heading">
          <div className="space-y-1">
            <h2 id="operations-heading" className="font-heading text-lg font-bold text-foreground">{tr({ en: "Operations", pt: "Operações" })}</h2>
            <p className="text-sm text-muted-foreground">{tr({
              en: "The execution tooling behind the stories: communities run the program, the desk formalises and services, the entrepreneur reports.",
              pt: "As ferramentas de execução por trás das histórias: as comunidades conduzem o programa, a mesa formaliza e acompanha, a empreendedora reporta.",
            })}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {OPERATIONS.map((area) => {
              const Icon = area.icon;
              return (
                <li key={area.id}>
                  <button type="button" onClick={() => enter(area.persona.email, DEMO_PASSWORD, next === "/app" ? "/app" : next)} disabled={busy !== null}
                    className="panel flex h-full w-full flex-col items-start gap-2 p-4 text-left transition-colors hover:border-accent/50 disabled:opacity-60">
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-foreground">
                      <span className="flex items-center gap-2"><Icon size={16} className="text-accent" aria-hidden /> {area.label}</span>
                      {busy?.startsWith(area.persona.email) ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} className="text-muted-foreground" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{area.audience}</span>
                    <span className="text-[11px] text-muted-foreground">{area.persona.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
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
