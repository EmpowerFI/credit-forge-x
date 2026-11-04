import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <div className="flex justify-end">
        <LanguageSwitch />
      </div>
      <div className="mt-10 space-y-2">
        <p className="font-heading text-2xl font-semibold">EmpowerFI</p>
        {params.get("conta") === "excluida" && (
          <p role="status" className="mb-4 rounded-md bg-muted p-3 text-sm">
            {tr({ en: "Your account was deleted. Thank you for using the diary.", pt: "Sua conta foi excluída. Obrigada por usar o diário." })}
          </p>
        )}
        <h1 className="text-xl font-semibold">{title ?? tr({ en: "Your business diary", pt: "O diário do seu negócio" })}</h1>
        <p className="text-muted-foreground">
          {intro ?? tr({
            en: "Record what you sold and spent each day, in under a minute.",
            pt: "Registre o que vendeu e gastou a cada dia, em menos de um minuto.",
          })}
        </p>
      </div>

      {sentTo === null ? (
        <form onSubmit={send} className="mt-8 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="diary-email">{tr({ en: "Your e-mail", pt: "Seu e-mail" })}</Label>
            <Input
              id="diary-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
              required
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {tr({ en: "Send me a code", pt: "Receber código" })}
          </Button>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "We send a 6-digit code to your e-mail. No password needed.",
              pt: "Enviamos um código de 6 números para o seu e-mail. Não precisa de senha.",
            })}
          </p>
        </form>
      ) : (
        <div className="mt-8 space-y-4">
          <p>
            {tr({ en: "We sent a code to ", pt: "Enviamos um código para " })}
            <strong className="break-all">{sentTo}</strong>.
            {" "}
            {tr({ en: "It may take a minute; check the spam folder too.", pt: "Pode levar um minuto; olhe também no spam." })}
          </p>
          <Label htmlFor="diary-code">{tr({ en: "Code", pt: "Código" })}</Label>
          <InputOTP
            id="diary-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === CODE_LENGTH) void verify(v);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={busy}
          >
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, i) => <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />)}
            </InputOTPGroup>
          </InputOTP>
          {busy && <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Checking", pt: "Conferindo" })} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void send()} disabled={busy}>
              {tr({ en: "Send a new code", pt: "Enviar outro código" })}
            </Button>
            <Button variant="ghost" onClick={() => { setSentTo(null); setError(null); }} disabled={busy}>
              {tr({ en: "Change e-mail", pt: "Trocar e-mail" })}
            </Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm font-medium text-destructive">{error}</p>}
    </main>
  );
}
