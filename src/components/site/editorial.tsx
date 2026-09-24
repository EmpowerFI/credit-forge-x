import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * The devices the corporate site is built from (founder's reference, 24 Sep):
 * a mark-and-capitals eyebrow, graded gold rules, a status line under a
 * hairline, and two buttons. No cards, no glow — the page is held together by
 * rules and alignment.
 */

/** The brand mark, at the size the eyebrow or the wordmark asks for. */
export const Mark = ({ size = 26, className = "" }: { size?: number; className?: string }) => (
  <img src="/empowerfi-mark.png" alt="" width={size} height={size} className={className}
    style={{ width: size, height: size }} aria-hidden />
);

/**
 * Mark plus wide-tracked capitals: how every section announces itself. A span,
 * not a paragraph, so a section whose eyebrow *is* its heading can wrap it in
 * an <h2> without producing invalid markup.
 */
export const Eyebrow = ({ children, mark = true }: { children: ReactNode; mark?: boolean }) => (
  <span className="flex items-center gap-3.5">
    {mark && <Mark size={24} className="shrink-0" />}
    <span className="eyebrow">{children}</span>
  </span>
);

/**
 * The rule above a column, at the weight its position asks for. Three columns
 * read as a sequence rather than as three equals — the first leads.
 */
export const GradedRule = ({ index }: { index: number }) => (
  <div className={["rule-gold", "rule-gold-2", "rule-gold-3"][Math.min(index, 2)]} aria-hidden />
);

/**
 * Where something actually stands, set off by a hairline. The site says this
 * beside every claim, so a reader never has to guess what is live and what is
 * a plan.
 */
export const StatusNote = ({ label, children }: { label: string; children: ReactNode }) => (
  <p className="mt-6 border-t border-foreground/15 pt-3.5 text-sm leading-relaxed text-foreground/80">
    <span className="label-ui mr-2 text-foreground/90">{label}</span>
    {children}
  </p>
);

type ButtonProps = {
  children: ReactNode;
  /** Gold-ruled: the one action the section is asking for. */
  primary?: boolean;
  className?: string;
};

/** Internal route. */
export const SiteLinkButton = ({ to, children, primary, className = "" }: ButtonProps & { to: string }) => (
  <Link to={to} className={`btn-site ${primary ? "btn-site-primary" : ""} ${className}`}>{children}</Link>
);

/** Anchor or external target. */
export const SiteAnchorButton = ({ href, children, primary, className = "", ...rest }: ButtonProps & {
  href: string; target?: string; rel?: string;
}) => (
  <a href={href} className={`btn-site ${primary ? "btn-site-primary" : ""} ${className}`} {...rest}>{children}</a>
);

/**
 * The sentence a section wants remembered, hung off a short gold rule. Used
 * sparingly — one per section at most, or it stops being emphasis.
 */
export const PullQuote = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-5 text-xl leading-snug text-foreground md:text-[1.3rem]">
    <span className="mt-[0.85rem] h-[1.5px] w-11 shrink-0 bg-gold" aria-hidden />
    <span>{children}</span>
  </p>
);

/** A row of items marked by a small gold ring, as the reference lists them. */
export const RingList = ({ items }: { items: readonly string[] }) => (
  <ul className="space-y-3">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-3.5 text-[1.0625rem] leading-snug text-foreground">
        <span className="mt-[0.45rem] h-3 w-3 shrink-0 rounded-full border-[1.5px] border-gold" aria-hidden />
        {item}
      </li>
    ))}
  </ul>
);
