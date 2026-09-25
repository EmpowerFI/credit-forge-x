import { useState } from "react";

interface SupportLogoProps {
  /** Path under /public, e.g. "/sebrae.svg". */
  src: string;
  alt: string;
  /** Small caption above the mark, e.g. "Apoio institucional". Omit it where
   *  the surrounding block already says the same thing. */
  label?: string;
  /**
   * Taller rendering, for a mark carrying a second line of type that would be
   * illegible at the default height — the Unicamp seal's "empresa-filha" sits
   * under the wordmark and needs the room.
   */
  large?: boolean;
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
const SupportLogo = ({ src, alt, label, large = false }: SupportLogoProps) => {
  const [status, setStatus] = useState<"pending" | "loaded" | "failed">("pending");
  if (status === "failed") return null;

  return (
    <div className={status === "loaded" ? "mt-5 space-y-2.5 border-t border-foreground/15 pt-4" : "hidden"}>
      {label && <p className="label-ui text-foreground/70">{label}</p>}
      <img
        src={src}
        alt={alt}
        // Eager on purpose: a hidden image still loads, and resolving during the
        // initial load means the block settles before anyone scrolls to it.
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className={large
          ? "h-[4.5rem] w-auto max-w-[220px] object-contain object-left"
          : "h-12 w-auto max-w-[180px] object-contain object-left"}
      />
    </div>
  );
};

export default SupportLogo;
