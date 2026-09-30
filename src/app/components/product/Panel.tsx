import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** A titled section of a workspace: title, optional context and actions, then content. */
export default function Panel({ id, title, description, actions, children, className = "", folded }: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * Starts closed, the title as the handle. For a panel that answers a question
   * a reader may not be asking yet: it keeps its place in the page and its
   * heading in the outline, and costs one line until it is wanted.
   */
  folded?: boolean;
}) {
  if (folded) {
    return (
      <details id={id} className={`panel group min-w-0 scroll-mt-32 p-5 sm:p-6 ${className}`}>
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="flex items-center gap-1.5 font-heading text-base font-bold text-foreground group-hover:text-accent">
              <ChevronRight size={15} className="text-accent transition-transform group-open:rotate-90" aria-hidden />
              {title}
            </h2>
            {description && <p className="pl-[21px] text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </summary>
        <div className="space-y-4 pt-4">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className={`panel min-w-0 scroll-mt-32 space-y-4 p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="font-heading text-base font-bold text-foreground">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
