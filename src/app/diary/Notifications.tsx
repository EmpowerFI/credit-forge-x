import { useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
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
    <section className="space-y-3 rounded-md border border-border p-4 text-sm" aria-live="polite">
      <h2 className="text-base font-semibold">{tr({ en: "Notifications on this phone", pt: "Notificações neste celular" })}</h2>

      {status === "checking" && <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Checking", pt: "Conferindo" })} />}

      {status === "needs-install" && (
        <p>
          {tr({
            en: "On iPhone, notifications only work with the diary on the home screen. Install it (steps below), open it from the icon, and come back here.",
            pt: "No iPhone, as notificações só funcionam com o diário na tela de início. Instale (passos abaixo), abra pelo ícone e volte aqui.",
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
              ? tr({ en: "To allow them: Settings → Notifications → Diário → Allow Notifications.", pt: "Para liberar: Ajustes → Notificações → Diário → Permitir Notificações." })
              : tr({
                en: "To allow them: open the site settings (the icon beside the address, or the app info of the installed diary) → Notifications → Allow. Then reload this page.",
                pt: "Para liberar: abra as configurações do site (o ícone ao lado do endereço, ou as informações do app instalado) → Notificações → Permitir. Depois recarregue esta página.",
              })}
          </p>
        </div>
      )}

      {status === "off" && (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            {tr({
              en: "Get the daily reminder here, even with the diary closed. Only on days you have not recorded yet, never with your figures.",
              pt: "Receba o lembrete diário aqui, mesmo com o diário fechado. Só nos dias em que você ainda não registrou, e nunca com os seus valores.",
            })}
          </p>
          <Button className="h-11" disabled={busy || !ready} onClick={() => void run(async () => {
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
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-medium">
            <BellRing size={18} className="text-primary" aria-hidden="true" />
            {tr({ en: "On for this phone.", pt: "Ativadas neste celular." })}
          </p>
          {!remindersOn && (
            <p className="text-muted-foreground">
              {tr({ en: "The daily reminder is off above, so nothing will come until you turn it on.", pt: "O lembrete diário está desligado acima, então nada vai chegar até você ligar." })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" disabled={busy} onClick={() => void run(async () => {
              const r = await test();
              return r.accepted > 0
                ? tr({ en: "Sent. It should arrive in a few seconds.", pt: "Enviada. Deve chegar em alguns segundos." })
                : tr({ en: "It could not be sent to this phone. Turn notifications off and on again.", pt: "Não deu para enviar para este celular. Desative e ative de novo." });
            })}>
              {spinner}
              {tr({ en: "Send a test", pt: "Enviar um teste" })}
            </Button>
            <Button variant="ghost" className="h-11" disabled={busy} onClick={() => void run(async () => {
              await disable();
              return null;
            })}>
              {tr({ en: "Turn off on this phone", pt: "Desativar neste celular" })}
            </Button>
          </div>
        </div>
      )}

      {note && <p role="status">{note}</p>}
      {error && <p role="alert" className="font-medium text-destructive">{error}</p>}
    </section>
  );
}
