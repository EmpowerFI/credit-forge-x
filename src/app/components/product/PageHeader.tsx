import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { tr } from "../../i18n";

/** The top of a screen: where you are, what it is for, and what you can do. */
export default function PageHeader({ eyebrow, title, description, actions, meta, about, aboutLabel }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One line: what this screen answers. Everything longer belongs in `about`. */
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  /** The method, the caveats and the fine print, folded away until asked for. */
  about?: ReactNode;
  aboutLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-widest text-accent">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
          {meta}
        </div>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
        {about && (
          <details className="max-w-3xl pt-1 [&[open]>summary>svg]:rotate-90">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent hover:text-foreground">
              <ChevronRight size={13} className="transition-transform" aria-hidden />
              {aboutLabel ?? tr({ en: "How this is computed", pt: "Como isto é calculado" })}
            </summary>
            <div className="space-y-2 pt-2 text-xs leading-relaxed text-muted-foreground">{about}</div>
          </details>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
