import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** A titled section of a workspace: title, optional context and actions, then content. */
export default function Panel({ id, title, description, actions, children, className = "", folded, numeral }: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * A movement of one argument rather than a card of its own: the numeral sits
   * in a gutter, a rule separates it from the movement before, and the card
   * chrome goes. Six bordered boxes stacked down a page read as six subjects;
   * numbered movements under one rule read as one.
   */
  numeral?: string;
  /**
   * Starts closed, the title as the handle. For a panel that answers a question
   * a reader may not be asking yet: it keeps its place in the page and its
   * heading in the outline, and costs one line until it is wanted.
   */
  folded?: boolean;
}) {
  const GUTTER = "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[3rem_minmax(0,1fr)]";
  const MOVEMENT = "min-w-0 scroll-mt-32 border-t border-border py-6 first:border-t-0 first:pt-0";

  if (folded) {
    const head = (
      <>
        <h2 className={`flex items-center gap-1.5 font-heading font-bold text-foreground group-hover:text-accent ${numeral ? "text-xl sm:text-2xl" : "text-base"}`}>
          <ChevronRight size={15} className="text-accent transition-transform group-open:rotate-90" aria-hidden />
          {title}
        </h2>
        {description && <p className="max-w-prose pl-[21px] text-sm text-muted-foreground">{description}</p>}
      </>
    );
    // A folded movement keeps its numeral and its gutter, so folding something
    // does not drop it out of the argument's numbering. The gutter is applied to
    // the summary and to the content separately: a details element is not a
    // grid its own children can be placed in reliably.
    if (numeral) {
      return (
        <details id={id} className={`group ${MOVEMENT} ${className}`}>
          <summary className={`${GUTTER} cursor-pointer list-none`}>
            <p aria-hidden className="font-heading text-xl font-normal leading-none text-accent sm:text-2xl">{numeral}</p>
            <div className="min-w-0 space-y-1">{head}</div>
          </summary>
          <div className={`${GUTTER} pt-4`}>
            <span aria-hidden />
            <div className="min-w-0 space-y-4">{children}</div>
          </div>
        </details>
      );
    }
    return (
      <details id={id} className={`panel group min-w-0 scroll-mt-32 p-5 sm:p-6 ${className}`}>
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">{head}</div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </summary>
        <div className="space-y-4 pt-4">{children}</div>
      </details>
    );
  }

  if (numeral) {
    return (
      <section id={id} className={`${GUTTER} ${MOVEMENT} ${className}`}>
        <p aria-hidden className="font-heading text-xl font-normal leading-none text-accent sm:text-2xl">{numeral}</p>
        <div className="min-w-0 space-y-4">
          {(title || actions) && (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="min-w-0 space-y-1">
                {title && <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">{title}</h2>}
                {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </section>
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
