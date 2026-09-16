import { cn } from "@/lib/utils";
import { tr } from "../../i18n";

/**
 * "EVC" with its full name beside it, smaller, so no one has to guess the
 * acronym; the definition is on hover.
 */
export default function EvcLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn("whitespace-nowrap", className)}
      title={tr({
        en: "Economic Value Created: the extra profit a business made after its loan, less what the credit cost.",
        pt: "Valor Econômico Criado: o lucro a mais que o negócio teve depois do empréstimo, menos o custo do crédito.",
      })}
    >
      EVC{" "}
      <span className="text-[0.8em] font-normal text-muted-foreground">
        ({tr({ en: "Economic Value Created", pt: "Valor Econômico Criado" })})
      </span>
    </span>
  );
}
