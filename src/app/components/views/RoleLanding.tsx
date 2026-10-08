import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tr } from "../../i18n";
import { type View, VIEWS } from "../../lib/views";

/** "View platform as": the views on offer, as one choice. A hidden view is not
 * one of them — see `View.hidden`. */
export function ViewChoice({ value, onChange, className }: { value: View["id"]; onChange: (id: View["id"]) => void; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <p id="view-choice-label" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {tr({ en: "View platform as", pt: "Ver plataforma como" })}
      </p>
      <div role="radiogroup" aria-labelledby="view-choice-label" className="flex flex-wrap gap-2">
        {VIEWS.filter((v) => !v.hidden).map((v) => {
          const Icon = v.icon;
          const active = v.id === value;
          return (
            <button key={v.id} type="button" role="radio" aria-checked={active} onClick={() => onChange(v.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors",
                active ? "border-accent bg-accent text-accent-foreground font-semibold" : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground",
              )}>
              <Icon size={15} aria-hidden /> {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A view's landing: what it is for, and the way in.
 *
 * It used to carry a "Your tools" grid as well — six cards per view, each a
 * door to a page whose own dashboard already lists it in the sidebar. Offering
 * the same six doors twice is what made the landing read as a second menu, so
 * the tools stay where they are used and this says only what the view is and
 * how to enter it.
 */
export default function RoleLanding({ view, cta, locked }: {
  view: View;
  cta: ReactNode;
  /** Why this account cannot open the view, if it cannot. */
  locked?: string;
}) {
  const Icon = view.icon;
  return (
    <div className="max-w-3xl space-y-3">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-accent"><Icon size={14} aria-hidden /> {view.label}</p>
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">{view.headline}</h1>
      <p className="text-lg text-muted-foreground">{view.lead}</p>
      <div className="flex flex-wrap items-center gap-2 pt-2">{cta}</div>
      {locked && <p className="rounded-lg border tone-caution px-3 py-2 text-sm">{locked}</p>}
    </div>
  );
}
