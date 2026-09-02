import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow: string;
  /** Plain part of the headline. */
  title: string;
  /** Trailing part rendered in the brand gradient — omit for a flat headline. */
  accent?: string;
  subtitle?: ReactNode;
  align?: "center" | "left";
}

/** The eyebrow / headline / subtitle block every section on the home page opens with. */
const SectionHeading = ({
  eyebrow,
  title,
  accent,
  subtitle,
  align = "center",
}: SectionHeadingProps) => (
  <div className={`space-y-4 ${align === "center" ? "text-center" : "text-left"}`}>
    <p className="text-sm font-medium uppercase tracking-widest text-accent">{eyebrow}</p>
    <h2 className="section-title">
      {title}
      {accent && (
        <>
          {" "}
          <span className="text-gradient">{accent}</span>
        </>
      )}
    </h2>
    {subtitle && (
      <p className={`section-subtitle ${align === "center" ? "" : "mx-0"}`}>{subtitle}</p>
    )}
  </div>
);

export default SectionHeading;
