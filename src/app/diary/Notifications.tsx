import { useState } from "react";
import { BellOff, BellRing, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import { diaryErrorText } from "./diary";
import { useInstall } from "./pwa";
import { usePush } from "./push";

/** "Notificações neste celular": on or off for this device, a test, and what to do when the phone says no. */
export default function Notifications({ remindersOn }: { remindersOn: boolean }) {
  const { device } = useInstall();
  const { status, ready, enable, disable, test } = usePush();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (what: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      setNote(await what());
    } catch (e) {
      const key = e instanceof Error ? e.message : "";
      setError(key === "too_many_tests"
        ? tr({ en: "That is enough tests for now. Try again in an hour.", pt: "Já foram testes suficientes por agora. Tente de novo daqui a uma hora." })
        : key === "test_failed" || key === "not_ready"
          ? tr({ en: "It did not work now. Try again in a moment.", pt: "Não funcionou agora. Tente de novo daqui a pouco." })
          : diaryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const spinner = busy && <Loader2 className="animate-spin" aria-hidden="true" />;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">{tr({ en: "Notifications", pt: "Notificações" })}</h2>
        {status === "on" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm text-emerald-900">
            <Check size={16} aria-hidden="true" />{tr({ en: "On", pt: "Ativadas" })}
          </span>
        )}
      </div>

      {status === "checking" && <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Checking", pt: "Conferindo" })} />}

      {status === "needs-install" && (
        <p>
          {tr({
            en: "On iPhone: install the diary on the home screen (below) and open it from the icon.",
            pt: "No iPhone: instale o diário na tela de início (abaixo) e abra pelo ícone.",
          })}
        </p>
      )}

      {status === "unsupported" && (
        <p>
          {device === "ios"
            ? tr({
              en: "This iPhone needs iOS 16.4 or newer to receive notifications. Check in Settings → General → Software Update.",
              pt: "Este iPhone precisa do iOS 16.4 ou mais novo para receber notificações. Veja em Ajustes → Geral → Atualização de Software.",
            })
            : tr({
              en: "This browser does not receive notifications. Open the diary in Chrome.",
              pt: "Este navegador não recebe notificações. Abra o diário no Chrome.",
            })}
        </p>
      )}

      {status === "denied" && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 font-medium"><BellOff size={18} aria-hidden="true" />{tr({ en: "Notifications are blocked on this phone.", pt: "As notificações estão bloqueadas neste celular." })}</p>
          <p className="text-muted-foreground">
            {device === "ios"
              ? tr({ en: "To allow them: Settings → Notifications → EmpowerFI Diário → Allow Notifications.", pt: "Para liberar: Ajustes → Notificações → EmpowerFI Diário → Permitir Notificações." })
              : tr({
                en: "To allow them: open the site settings (the icon beside the address, or the app info of the installed diary) → Notifications → Allow. Then reload this page.",
                pt: "Para liberar: abra as configurações do site (o ícone ao lado do endereço, ou as informações do app instalado) → Notificações → Permitir. Depois recarregue esta página.",
              })}
          </p>
        </div>
      )}

      {status === "off" && (
        <div className="space-y-2">
          <Button className="h-11 w-full text-base" disabled={busy || !ready} onClick={() => void run(async () => {
            await enable();
            return null;
          })}>
            {spinner}
            <BellRing aria-hidden="true" />
            {tr({ en: "Turn on notifications", pt: "Ativar notificações" })}
          </Button>
          {!ready && !busy && (
            <p className="text-muted-foreground">
              {tr({ en: "Getting ready… if this stays, reload the page.", pt: "Preparando… se continuar assim, recarregue a página." })}
            </p>
          )}
        </div>
      )}

      {status === "on" && (
        <div className="space-y-2">
          {!remindersOn && (
            <p className="text-muted-foreground">{tr({ en: "The daily reminder is off.", pt: "O lembrete diário está desligado." })}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-10 border-2 border-primary" disabled={busy} onClick={() => void run(async () => {
              const r = await test();
              return r.accepted > 0
                ? tr({ en: "Sent. It should arrive in a few seconds.", pt: "Enviada. Deve chegar em alguns segundos." })
                : tr({ en: "It could not be sent to this phone. Turn notifications off and on again.", pt: "Não deu para enviar para este celular. Desative e ative de novo." });
            })}>
              {spinner}
              {tr({ en: "Send a test", pt: "Enviar teste" })}
            </Button>
            <Button variant="outline" className="h-10 text-muted-foreground" disabled={busy} onClick={() => void run(async () => {
              await disable();
              return null;
            })}>
              {tr({ en: "Turn off", pt: "Desativar" })}
            </Button>
          </div>
        </div>
      )}

      {note && <p role="status">{note}</p>}
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </section>
  );
}
