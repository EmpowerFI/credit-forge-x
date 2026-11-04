import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALES, tr } from "./index";
import { useLocale } from "./useLocale";

/** EN | PT, wherever the app has a header: the layout, the login and a shared report. */
export default function LanguageSwitch({ className, variant = "inline" }: { className?: string; variant?: "inline" | "pill" }) {
  const { locale, setLocale } = useLocale();
  if (variant === "pill") {
    // A two-way segmented control: the diary's screens, where it sits alone in a corner.
    return (
      <div role="group" aria-label={tr({ en: "Language", pt: "Idioma" })}
        className={cn("inline-flex rounded-lg border border-border bg-card p-1 text-sm", className)}>
        {[...LOCALES].sort((a) => (a === "pt" ? -1 : 1)).map((l) => (
          <button key={l} type="button" onClick={() => setLocale(l)} aria-pressed={locale === l} lang={l === "pt" ? "pt-BR" : "en"}
            className={cn("min-h-9 min-w-11 rounded-md px-3 font-semibold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              locale === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {l}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div role="group" aria-label={tr({ en: "Language", pt: "Idioma" })} className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <Languages size={14} className="mr-0.5 text-muted-foreground" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          lang={l === "pt" ? "pt-BR" : "en"}
          className={cn(
            "rounded px-1.5 py-0.5 font-semibold uppercase transition-colors",
            locale === l ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
