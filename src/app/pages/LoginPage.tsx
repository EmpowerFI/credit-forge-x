import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimulatedBanner from "../components/SimulatedBanner";
import { useAuth } from "../auth/useAuth";
import { platformConfigured, ROLE_LABEL, type Role } from "../lib/platform";

// Judges have no inbox for magic links, so the demo runs on fixed-password
// accounts (PLAN_HACKATHON.md §G.2). The password is public on purpose: this
// is a demo project with simulated data only.
const DEMO_PASSWORD = "EmpowerFI-demo-2026";
const DEMO_ACCOUNTS: { email: string; role: Role }[] = [
  { email: "leader@demo.empowerfi.io", role: "community_leader" },
  { email: "admin@demo.empowerfi.io", role: "admin" },
  { email: "maria@demo.empowerfi.io", role: "entrepreneur" },
  { email: "partner@demo.empowerfi.io", role: "partner" },
  { email: "investor@demo.empowerfi.io", role: "capital_provider" },
  { email: "auditor@demo.empowerfi.io", role: "auditor" },
];

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error === "Invalid login credentials" ? "Wrong email or password." : error);
    else navigate(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <SimulatedBanner />
      <div className="container mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">EmpowerFI platform</p>
          <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Sign in</h1>
          <p className="leading-relaxed text-muted-foreground">
            Communities, readiness and the proofs behind them. Everything in this environment is
            simulated and anchored on Solana Devnet.
          </p>

          {!platformConfigured && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              The platform is not configured in this build (VITE_PLATFORM_SUPABASE_*).
            </p>
          )}

          <form onSubmit={submit} className="space-y-4 rounded-2xl p-6 glass glow-border">
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
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Sign in
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-foreground">Demo accounts</h2>
          <p className="text-sm text-muted-foreground">
            Pick a role to fill the form. Password for all: <code className="text-foreground">{DEMO_PASSWORD}</code>
          </p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError(null); }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/5"
                >
                  <span className="text-sm font-medium text-foreground">{ROLE_LABEL[a.role]}</span>
                  <span className="truncate text-xs text-muted-foreground">{a.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
