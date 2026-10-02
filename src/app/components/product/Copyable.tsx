import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../../i18n";

/**
 * Copies a value to the clipboard. Used wherever the screen hands something
 * over to be run or pasted elsewhere: a viewing key, a transaction id, a
 * command. `label` is what is being copied, already in the current language.
 */
export default function Copyable({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="secondary" size="sm" className={className}
      aria-label={tr({ en: `Copy ${label}`, pt: `Copiar ${label}` })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard refused: the value is on screen to select
        }
      }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? tr({ en: "Copied", pt: "Copiado" }) : tr({ en: "Copy", pt: "Copiar" })}
    </Button>
  );
}
