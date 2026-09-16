import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Briefcase, ClipboardCheck, Loader2, LogIn, PenLine, ShieldCheck, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataLegend from "../components/product/DataLegend";
import NetworkBadge from "../components/product/NetworkBadge";
import { useAuth } from "../auth/useAuth";
import { describeError } from "../lib/errors";
import { platformConfigured, type Role } from "../lib/platform";
import { shortAddress } from "../lib/solana";
import ConnectWalletDialog from "../wallet/ConnectWallet";
import { useWalletSignIn } from "../wallet/useWalletSignIn";
import { prototypeNotice } from "../lib/capital";
import { localized, tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";

// Judges have no inbox for magic links, so the demo runs on fixed-password
// accounts (PLAN_HACKATHON.md §G.2). The password is public on purpose: this
// is a demo project with simulated data only.
const DEMO_PASSWORD = "EmpowerFI-demo-2026";

// One entry per persona: the workspace it opens and what it is for.
const PERSONAS: { email: string; role: Role; workspace: string; description: string; icon: LucideIcon }[] = localized([
  { email: "investor@demo.empowerfi.io", role: "capital_provider",
    workspace: { en: "P2P Capital Console", pt: "Console de Capital P2P" },
    description: {
      en: "Qualified demand, the domestic and global pools, positions, repayments and the proofs behind them.",
      pt: "Demanda qualificada, os pools doméstico e global, posições, pagamentos e as provas por trás de tudo.",
    }, icon: Wallet },
  { email: "leader@demo.empowerfi.io", role: "community_leader",
    workspace: { en: "Community Intelligence", pt: "Inteligência Comunitária" },
    description: {
      en: "Where members stand on the way to readiness, and who needs what next.",
      pt: "Em que ponto cada integrante está no caminho da prontidão, e quem precisa do quê a seguir.",
    }, icon: Users },
  { email: "partner@demo.empowerfi.io", role: "partner",
    workspace: { en: "EmpowerFI P2P desk", pt: "Mesa P2P da EmpowerFI" },
    description: {
      en: "Funded opportunities to formalise at the engine's rate, loans to disburse and service.",
      pt: "Oportunidades captadas para formalizar na taxa do motor, empréstimos para desembolsar e acompanhar.",
    }, icon: Briefcase },
  { email: "auditor@demo.empowerfi.io", role: "auditor",
    workspace: { en: "Audit", pt: "Auditoria" },
    description: {
      en: "Every record, recomputed in your browser and checked against Solana.",
      pt: "Cada registro, recalculado no seu navegador e conferido na Solana.",
    }, icon: ShieldCheck },
  { email: "maria@demo.empowerfi.io", role: "entrepreneur",
    workspace: { en: "My business", pt: "Meu negócio" },
    description: {
      en: "Maria's readiness, her monthly check-in and what is still missing.",
      pt: "A prontidão da Maria, o check-in mensal dela e o que ainda falta.",
    }, icon: Store },
  { email: "admin@demo.empowerfi.io", role: "admin",
    workspace: { en: "EmpowerFI Admin", pt: "Admin da EmpowerFI" },
    description: {
      en: "Community verification and opportunities held for review.",
      pt: "Verificação de comunidades e oportunidades retidas para revisão.",
    }, icon: ClipboardCheck },
]);

/** After a wallet connects: one signature, and the investor is in. */
function WalletSignIn({ account, onDone, onCancel }: { account: UiWalletAccount; onDone: () => void; onCancel: () => void }) {
  const signIn = useWalletSignIn(account);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="panel space-y-4 p-5" role="dialog" aria-label={tr({ en: "Sign in with your wallet", pt: "Entrar com sua carteira" })}>
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-bold text-foreground">
          {tr({ en: `Sign in with ${shortAddress(account.address)}`, pt: `Entrar com ${shortAddress(account.address)}` })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tr({
            en: "Your wallet will ask you to sign a message proving you hold this address. No transaction, no fee.",
            pt: "Sua carteira vai pedir que você assine uma mensagem provando que controla este endereço. Sem transação, sem taxa.",
          })}
        </p>
      </div>
      {error && <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} className="gap-2"
          onClick={async () => {
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
          }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />} {tr({ en: "Sign the message", pt: "Assinar a mensagem" })}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>
      </div>
    </div>
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

  const enter = async (address: string, secret: string) => {
    setBusy(address);
    setError(null);
    const { error } = await signIn(address.trim(), secret);
    setBusy(null);
    if (error) setError(error === "Invalid login credentials" ? tr({ en: "Wrong email or password.", pt: "E-mail ou senha incorretos." }) : error);
    else navigate(next, { replace: true });
  };
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
          <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">{tr({ en: "Choose a workspace", pt: "Escolha uma área de trabalho" })}</h1>
          <p className="text-muted-foreground">
            {tr({
              en: "P2P productive credit from readiness to capital, with every step proven on Solana: enter any workspace as its demo account.",
              pt: "Crédito produtivo P2P da prontidão ao capital, com cada etapa provada na Solana: entre em qualquer área de trabalho com a conta de demonstração.",
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

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map(({ email: address, role, workspace, description, icon: Icon }) => (
            <li key={address} className="panel flex flex-col justify-between gap-5 p-5">
              <div className="space-y-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-accent">
                  <Icon size={20} aria-hidden />
                </span>
                <div className="space-y-1">
                  <h2 className="font-heading text-lg font-bold text-foreground">{workspace}</h2>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              <div className="space-y-2">
                {role === "capital_provider" && (
                  <Button onClick={() => setConnecting(true)} className="w-full justify-between">
                    <span>{tr({ en: "Connect wallet", pt: "Conectar carteira" })}</span> <Wallet size={16} />
                  </Button>
                )}
                <Button onClick={() => enter(address, DEMO_PASSWORD)} disabled={busy !== null}
                  variant="secondary" className="w-full justify-between" aria-label={tr({ en: `Enter ${workspace}`, pt: `Entrar em ${workspace}` })}>
                  <span>
                    {role === "capital_provider"
                      ? tr({ en: "Explore without a wallet", pt: "Explorar sem carteira" })
                      : tr({ en: "Enter as demo", pt: "Entrar como demo" })}
                  </span>
                  {busy === address ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                </Button>
              </div>
            </li>
          ))}
        </ul>

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
              {busy === email ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} {tr({ en: "Sign in", pt: "Entrar" })}
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
