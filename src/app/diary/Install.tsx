import { useState } from "react";
import { CheckCircle2, EllipsisVertical, Menu, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import { useInstall } from "./pwa";

const DISMISSED = "diary-install-dismissed";

/**
 * How to put the diary on her home screen, for the phone she holds: Chrome's
 * own dialog when Android offers it, the steps by hand otherwise. On an
 * iPhone it is also what reminders will need: iOS only notifies web apps
 * opened from the home screen.
 */
export function InstallSteps() {
  const { installed, device, canPrompt, prompt } = useInstall();

  if (installed) {
    return (
      <p className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-primary" aria-hidden="true" />
        {tr({ en: "The diary is installed on this phone.", pt: "O diário está instalado neste celular." })}
      </p>
    );
  }
  if (canPrompt) {
    return (
      <div className="space-y-3">
        <p>{tr({ en: "Open the diary from an icon, like an app.", pt: "Abra o diário por um ícone, como um aplicativo." })}</p>
        <Button className="h-11" onClick={() => void prompt()}>{tr({ en: "Install", pt: "Instalar" })}</Button>
      </div>
    );
  }
  if (device === "ios") {
    return (
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          {tr({ en: "Tap ", pt: "Toque em " })}
          <strong>{tr({ en: "Share", pt: "Compartilhar" })}</strong>{" "}
          <Share size={16} className="inline align-text-bottom" aria-hidden="true" />
          {tr({ en: " (in Safari, at the bottom of the screen).", pt: " (no Safari, embaixo da tela)." })}
        </li>
        <li>
          {tr({ en: "Choose ", pt: "Escolha " })}
          <strong>{tr({ en: "Add to Home Screen", pt: "Adicionar à Tela de Início" })}</strong>{" "}
          <SquarePlus size={16} className="inline align-text-bottom" aria-hidden="true" />
          {tr({ en: ". If you don't see it, scroll the list down.", pt: ". Se não aparecer, role a lista para baixo." })}
        </li>
        <li>{tr({ en: "Tap ", pt: "Toque em " })}<strong>{tr({ en: "Add", pt: "Adicionar" })}</strong>.</li>
      </ol>
    );
  }
  return (
    <ol className="list-decimal space-y-2 pl-5">
      <li>
        {tr({ en: "Open the browser menu ", pt: "Abra o menu do navegador " })}
        (<EllipsisVertical size={16} className="inline align-text-bottom" aria-label={tr({ en: "three dots", pt: "três pontinhos" })} />
        {tr({ en: " or ", pt: " ou " })}
        <Menu size={16} className="inline align-text-bottom" aria-label={tr({ en: "three lines", pt: "três tracinhos" })} />).
        {tr({
          en: " In Chrome it is at the top; in Samsung Internet, at the bottom.",
          pt: " No Chrome fica em cima; no Samsung Internet, embaixo.",
        })}
      </li>
      <li>
        {tr({ en: "Tap ", pt: "Toque em " })}
        <strong>{tr({ en: "Install app", pt: "Instalar app" })}</strong>
        {tr({ en: " or ", pt: " ou " })}
        <strong>{tr({ en: "Add to Home screen", pt: "Adicionar à tela inicial" })}</strong>
        {tr({ en: " (in Samsung Internet: Add page to → Home screen).", pt: " (no Samsung Internet: Adicionar página a → Tela de início)." })}
      </li>
    </ol>
  );
}

/** After a recorded day, once: the moment she has seen what the diary is for. "Not now" is kept on this phone. */
export function InstallInvite() {
  const { installed, device } = useInstall();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === "1";
    } catch {
      return false;
    }
  });
  if (installed || hidden || device === "other") return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch { /* private mode: it only shows again */ }
  };

  return (
    <section className="space-y-3 rounded-md border border-border p-4 text-sm">
      <h2 className="text-base font-semibold">
        {tr({ en: "Tomorrow, open it faster", pt: "Amanhã, abra mais rápido" })}
      </h2>
      <p className="text-muted-foreground">
        {tr({
          en: "Put the diary on your home screen. It opens like an app, even with a weak signal.",
          pt: "Coloque o diário na tela de início do celular. Ele abre como um aplicativo, mesmo com internet fraca.",
        })}
      </p>
      <InstallSteps />
      <Button variant="ghost" className="h-10 px-2" onClick={dismiss}>{tr({ en: "Not now", pt: "Agora não" })}</Button>
    </section>
  );
}
