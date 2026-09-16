import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALES, tr } from "./index";
import { useLocale } from "./LocaleProvider";

/** EN | PT, wherever the app has a header: the layout, the login and a shared report. */
export default function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
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
