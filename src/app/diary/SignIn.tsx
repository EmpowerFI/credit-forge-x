import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { DiaryLogo } from "./Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { diaryDb, useDiarySession } from "./db";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";

const CODE_LENGTH = 6;

/**
 * Sign in or sign up in one: her e-mail, then the six-digit code sent to it.
 * No password to forget. The e-mail she uses in the EmpowerFI app opens the
 * same account; a new e-mail creates one, and the diary then asks the
 * sign-up questions.
 */
export default function SignIn({ home = "/app/diario", title, intro }: {
  /** Where she lands, and the only prefix a ?next= may point into. */
  home?: string;
  title?: string;
  intro?: string;
} = {}) {
  const { session } = useDiarySession();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith(home) ? params.get("next")! : home;
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seconds before another code may be asked for: the e-mail takes up to a
  // minute, and asking again sooner only invalidates the one on its way.
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (session) return <Navigate to={next} replace />;

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(tr({ en: "Check your e-mail address.", pt: "Confira o seu e-mail." }));
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await diaryDb.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setError(error.status === 429
        ? tr({ en: "Too many codes requested. Wait a few minutes and try again.", pt: "Muitos códigos pedidos. Espere alguns minutos e tente de novo." })
        : tr({ en: "We could not send the code. Try again.", pt: "Não conseguimos enviar o código. Tente de novo." }));
      return;
    }
    setSentTo(address);
    setCode("");
    setWait(60);
  };

  const verify = async (value: string) => {
    if (!sentTo || value.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    const { error } = await diaryDb.auth.verifyOtp({ email: sentTo, token: value, type: "email" });
    setBusy(false);
    if (error) {
      setError(tr({ en: "That code did not work. Check it, or ask for a new one.", pt: "Esse código não funcionou. Confira, ou peça um novo." }));
      setCode("");
    }
    // On success the session changes and the redirect above takes her in.
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6 pt-6">
      <div className="flex items-center justify-between gap-3">
        {sentTo === null ? (
          <DiaryLogo />
        ) : (
          <button type="button" onClick={() => { setSentTo(null); setError(null); }} disabled={busy}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft size={20} aria-hidden="true" />{tr({ en: "Change e-mail", pt: "Trocar e-mail" })}
          </button>
        )}
        <LanguageSwitch variant="pill" />
      </div>

      {params.get("conta") === "excluida" && (
        <p role="status" className="mt-6 rounded-lg bg-secondary p-4 text-sm">
          {tr({ en: "Your account was deleted. Thank you for using EmpowerFI Diário.", pt: "Sua conta foi excluída. Obrigada por usar o EmpowerFI Diário." })}
        </p>
      )}

      {sentTo === null ? (
        <>
          <div className="mt-12 space-y-2">
            <h1 className="font-heading text-[1.75rem] font-semibold leading-tight">
              {title ?? tr({ en: "Your business diary.", pt: "O diário do seu negócio." })}
            </h1>
            {intro && <p className="text-muted-foreground">{intro}</p>}
          </div>
          <form onSubmit={send} className="mt-8 space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="diary-email">{tr({ en: "Your e-mail", pt: "Seu e-mail" })}</Label>
              <Input id="diary-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
                placeholder={tr({ en: "you@example.com", pt: "voce@exemplo.com" })}
                value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-card text-base" required />
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {tr({ en: "Send me a code", pt: "Receber código" })}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="mt-10 space-y-1">
            <h1 className="font-heading text-[1.75rem] font-semibold leading-tight">{tr({ en: "Check your e-mail.", pt: "Confira seu e-mail." })}</h1>
            <p className="break-all text-muted-foreground">{sentTo}</p>
          </div>
          <div className="mt-6 space-y-2">
            <Label htmlFor="diary-code">{tr({ en: "6-digit code", pt: "Código de 6 números" })}</Label>
            <InputOTP id="diary-code" maxLength={CODE_LENGTH} value={code} inputMode="numeric" autoComplete="one-time-code" disabled={busy}
              containerClassName="w-full"
              onChange={(v) => {
                setCode(v);
                if (v.length === CODE_LENGTH) void verify(v);
              }}>
              <InputOTPGroup className="grid w-full grid-cols-6 gap-2">
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <InputOTPSlot key={i} index={i}
                    className="h-12 w-full rounded-lg border-2 border-input bg-card font-heading text-xl first:rounded-lg first:border-l-2 last:rounded-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {busy && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={16} aria-hidden="true" />{tr({ en: "Checking…", pt: "Conferindo…" })}
              </p>
            )}
          </div>
          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">{tr({ en: "Not there? Check spam.", pt: "Não chegou? Veja no spam." })}</p>
            <Button variant="outline" className="h-11 w-full text-base" disabled={busy || wait > 0} onClick={() => void send()}>
              {wait > 0
                ? tr({ en: `Send another code in 0:${String(wait).padStart(2, "0")}`, pt: `Enviar outro código em 0:${String(wait).padStart(2, "0")}` })
                : tr({ en: "Send another code", pt: "Enviar outro código" })}
            </Button>
          </div>
        </>
      )}

      {error && <p role="alert" className="mt-4 text-sm font-medium text-destructive">{error}</p>}
    </main>
  );
}
