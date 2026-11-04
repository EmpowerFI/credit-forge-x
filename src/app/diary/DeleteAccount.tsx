import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr } from "../i18n";
import { diaryDb } from "./db";
import { diary, diaryErrorText } from "./diary";

const WORD = "EXCLUIR";

/**
 * Deleting her EmpowerFI account, from the diary. The login is the app's
 * too, so this deletes both, as the founder decided: first the diary erases
 * everything it keeps of her (diary_account_forget), then the app's own
 * account-delete removes the login, the app profile, photos and
 * subscriptions. If the second step fails the first has still happened, and
 * she can simply try again.
 */
export default function DeleteAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const erase = async () => {
    setBusy(true);
    setError(null);
    try {
      await diary.forget();
      const { error: fnError } = await diaryDb.functions.invoke("account-delete", { body: { confirmation_text: WORD } });
      if (fnError) {
        setError(tr({
          en: "Your diary was deleted, but the login could not be deleted right now. Try again in a moment.",
          pt: "Seu diário foi apagado, mas não conseguimos apagar o login agora. Tente de novo daqui a pouco.",
        }));
        return;
      }
      setDone(true);
      await diaryDb.auth.signOut().catch(() => undefined);
      queryClient.removeQueries({ queryKey: ["diary"] });
      // Signed out, the diary goes to its sign-in, which says it is done.
      navigate("/app/diario/entrar?conta=excluida", { replace: true });
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p role="status" className="rounded-md bg-muted p-4 text-sm">
        {tr({ en: "Your account was deleted. Thank you for using the diary.", pt: "Sua conta foi excluída. Obrigada por usar o diário." })}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-destructive/40 p-4 text-sm" aria-labelledby="delete-title">
      <h2 id="delete-title" className="text-base font-semibold">{tr({ en: "Delete account", pt: "Excluir conta" })}</h2>
      {!open ? (
        <Button variant="outline" className="h-11 border-destructive/50 text-destructive" onClick={() => setOpen(true)}>
          {tr({ en: "Delete my account", pt: "Excluir minha conta" })}
        </Button>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (typed === WORD) void erase(); }}>
          <p>
            {tr({
              en: "This deletes your EmpowerFI account for good: every day you recorded, your goals, rewards and reminders, and also your account in the EmpowerFI app (profile, business, photos). It cannot be undone.",
              pt: "Isso apaga a sua conta EmpowerFI para sempre: todos os dias que você registrou, suas metas, prêmios e lembretes, e também a sua conta no aplicativo EmpowerFI (perfil, negócio, fotos). Não dá para desfazer.",
            })}
          </p>
          <div className="space-y-1">
            <Label htmlFor="delete-word">{tr({ en: `Type ${WORD} to confirm`, pt: `Digite ${WORD} para confirmar` })}</Label>
            <Input id="delete-word" value={typed} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              onChange={(e) => setTyped(e.target.value.trim().toUpperCase())} className="h-12 text-base" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" variant="destructive" className="h-11" disabled={busy || typed !== WORD}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {tr({ en: "Delete for good", pt: "Excluir para sempre" })}
            </Button>
            <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => { setOpen(false); setTyped(""); setError(null); }}>
              {tr({ en: "Cancel", pt: "Cancelar" })}
            </Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </section>
  );
}
