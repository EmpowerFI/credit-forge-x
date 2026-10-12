import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "../auth/useAuth";
import { isDemoDomain } from "../lib/stories";
import { platformConfigured } from "../lib/platform";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";

/**
 * The way in to the corporate build: the one that reads the production
 * database.
 *
 * It is a plain credentials form and nothing else. No persona cards, no
 * one-click entry, no simulated-data badge -- the showroom's front door is
 * all three of those, and this is not that building. There is no sign-up
 * either: an account here is granted by EmpowerFI, because the dashboards
 * behind it carry real women's figures.
 *
 * What this form does NOT do is decide who sees what. Row-level security does
 * that, in the database, by role -- which is why a wrong build could not open
 * anything a wrong session was not already entitled to.
 */
export default function CorporateSignIn() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={next} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    // The showroom's persona addresses are still strings in this bundle --
    // the bundler keeps them -- and they open a project of simulated data
    // with a published password. None of them has an account in the
    // production database, and this door will not ask whether one appeared.
    if (isDemoDomain(email)) {
      setError(tr({ en: "That is a showroom account. It does not open this one.", pt: "Essa é uma conta do showroom. Ela não abre esta área." }));
      return;
    }
    setBusy(true);
    const { error: failure } = await signIn(email.trim(), password);
    setBusy(false);
    if (failure) {
      // The same message for a wrong address and a wrong password: which of
      // the two was wrong is itself an answer about who has an account here.
      setError(
        failure === "Invalid login credentials"
          ? tr({ en: "Wrong e-mail or password.", pt: "E-mail ou senha incorretos." })
          : failure,
      );
      return;
    }
    navigate(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <span className="font-heading text-xl font-bold text-gradient">EmpowerFI</span>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-12 md:py-20">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {tr({ en: "Sign in", pt: "Entrar" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr({
            en: "Access is granted by EmpowerFI. Ask us if you do not have an account.",
            pt: "O acesso é concedido pela EmpowerFI. Fale com a gente se você ainda não tem conta.",
          })}
        </p>

        {!platformConfigured && (
          <p className="mt-6 rounded-lg border tone-alert p-3 text-sm" role="alert">
            {tr({
              en: "This build has no database configured (VITE_PLATFORM_SUPABASE_*).",
              pt: "Esta build não tem banco configurado (VITE_PLATFORM_SUPABASE_*).",
            })}
          </p>
        )}

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{tr({ en: "E-mail", pt: "E-mail" })}</Label>
            <Input
              id="email" type="email" name="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={busy || !platformConfigured}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{tr({ en: "Password", pt: "Senha" })}</Label>
            <Input
              id="password" type="password" name="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={busy || !platformConfigured}
            />
          </div>

          {error && (
            <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>
          )}

          <Button type="submit" size="lg" className="w-full gap-2" disabled={busy || !platformConfigured}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {tr({ en: "Sign in", pt: "Entrar" })}
          </Button>
        </form>
      </main>
    </div>
  );
}
