import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Briefcase, ClipboardCheck, Loader2, LogIn, ShieldCheck, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataLegend from "../components/product/DataLegend";
import NetworkBadge from "../components/product/NetworkBadge";
import { useAuth } from "../auth/useAuth";
import { platformConfigured, type Role } from "../lib/platform";

// Judges have no inbox for magic links, so the demo runs on fixed-password
// accounts (PLAN_HACKATHON.md §G.2). The password is public on purpose: this
// is a demo project with simulated data only.
const DEMO_PASSWORD = "EmpowerFI-demo-2026";

// One entry per persona: the workspace it opens and what it is for.
const PERSONAS: { email: string; role: Role; workspace: string; description: string; icon: LucideIcon }[] = [
  { email: "investor@demo.empowerfi.io", role: "capital_provider", workspace: "Investor Console",
    description: "Qualified opportunities, positions, repayments and the proofs behind them.", icon: Wallet },
  { email: "leader@demo.empowerfi.io", role: "community_leader", workspace: "Community Intelligence",
    description: "Where members stand on the way to readiness, and who needs what next.", icon: Users },
  { email: "partner@demo.empowerfi.io", role: "partner", workspace: "Partner Desk",
    description: "Pseudonymous opportunities to formalise, loans to disburse and service.", icon: Briefcase },
  { email: "auditor@demo.empowerfi.io", role: "auditor", workspace: "Audit",
    description: "Every record, recomputed in your browser and checked against Solana.", icon: ShieldCheck },
  { email: "maria@demo.empowerfi.io", role: "entrepreneur", workspace: "My business",
    description: "Maria's readiness, her monthly check-in and what is still missing.", icon: Store },
  { email: "admin@demo.empowerfi.io", role: "admin", workspace: "EmpowerFI Admin",
    description: "Community verification and opportunities held for review.", icon: ClipboardCheck },
];

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (session) return <Navigate to={next} replace />;

  const enter = async (address: string, secret: string) => {
    setBusy(address);
    setError(null);
    const { error } = await signIn(address.trim(), secret);
    setBusy(null);
    if (error) setError(error === "Invalid login credentials" ? "Wrong email or password." : error);
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
              Simulated data
            </span>
            <NetworkBadge />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 md:py-14">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">EmpowerFI platform</p>
          <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Choose a workspace</h1>
          <p className="text-muted-foreground">
            Productive credit from readiness to capital, with every step proven on Solana. This environment runs on
            devnet with simulated data: enter any workspace as its demo account.
          </p>
          <DataLegend />
        </div>

        {!platformConfigured && (
          <p className="rounded-lg border tone-alert p-3 text-sm">
            The platform is not configured in this build (VITE_PLATFORM_SUPABASE_*).
          </p>
        )}
        {error && <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>}

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
              <Button onClick={() => enter(address, DEMO_PASSWORD)} disabled={busy !== null}
                variant={role === "capital_provider" ? "default" : "secondary"} className="w-full justify-between"
                aria-label={`Enter ${workspace}`}>
                <span>Enter as demo</span>
                {busy === address ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              </Button>
            </li>
          ))}
        </ul>

        <details className="panel max-w-xl p-5">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Sign in with email</summary>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy !== null} className="w-full gap-2">
              {busy === email ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Sign in
            </Button>
            <p className="text-xs text-muted-foreground">
              Demo accounts use the password <code className="text-foreground">{DEMO_PASSWORD}</code>.
            </p>
          </form>
        </details>
      </main>
    </div>
  );
}
