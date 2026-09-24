import type { ReactNode } from "react";
import { Eyebrow } from "@/components/site/editorial";

interface SectionHeadingProps {
  eyebrow: string;
  /** Plain part of the headline. */
  title: string;
  /** Trailing part, set in gold italic — the phrase the sentence turns on. */
  accent?: string;
  subtitle?: ReactNode;
  align?: "center" | "left";
}

/**
 * The eyebrow / headline / subtitle block every section opens with.
 *
 * Left-aligned by default: the reference sets the whole site flush left, which
 * gives long Portuguese headlines a straight edge to hang from instead of a
 * ragged centre. `align="center"` is still there for the pages that want it.
 */
const SectionHeading = ({
  eyebrow,
  title,
  accent,
  subtitle,
  align = "left",
}: SectionHeadingProps) => {
  const centred = align === "center";
  return (
    <div className={centred ? "flex flex-col items-center text-center" : ""}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="section-title mt-5 max-w-4xl">
        {title}
        {accent && (
          <>
            {" "}
            <em className="italic text-accent">{accent}</em>
          </>
        )}
      </h2>
      {subtitle && (
        <p className={`section-subtitle mt-7 ${centred ? "" : "mx-0"}`}>{subtitle}</p>
      )}
    </div>
  );
};

export default SectionHeading;
