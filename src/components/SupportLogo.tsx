import { useState } from "react";

interface SupportLogoProps {
  /** Path under /public, e.g. "/sebrae.svg". */
  src: string;
  alt: string;
  /** Small caption above the mark, e.g. "Apoio institucional". */
  label: string;
}

/**
 * Third-party mark shown at the foot of a card to evidence institutional
 * backing.
 *
 * Loaded from /public by URL rather than imported as a module so a missing file
 * cannot break the build.
 *
 * The block takes up no space until the image has actually loaded. An earlier
 * version rendered first and removed itself on error, which cost nothing
 * visually but shifted every anchor below it: the image was lazy, so the card
 * only collapsed once the reader scrolled near it, and by then a "/#pilot" jump
 * had already landed — leaving the target ~90px off. Reserving space only for a
 * mark that exists keeps the page height honest from first paint.
 */
const SupportLogo = ({ src, alt, label }: SupportLogoProps) => {
  const [status, setStatus] = useState<"pending" | "loaded" | "failed">("pending");
  if (status === "failed") return null;

  return (
    <div className={status === "loaded" ? "mt-5 space-y-2.5 border-t border-border pt-4" : "hidden"}>
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <img
        src={src}
        alt={alt}
        // Eager on purpose: a hidden image still loads, and resolving during the
        // initial load means the block settles before anyone scrolls to it.
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className="h-12 w-auto max-w-[180px] object-contain object-left"
      />
    </div>
  );
};

export default SupportLogo;
