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
 * cannot break the build, and the whole block removes itself if the image fails
 * to load — a broken-image icon under "institutional support" would undercut
 * exactly the credibility the logo is there to lend.
 */
const SupportLogo = ({ src, alt, label }: SupportLogoProps) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <div className="mt-5 space-y-2.5 border-t border-border pt-4">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-9 w-auto max-w-[160px] object-contain object-left"
      />
    </div>
  );
};

export default SupportLogo;
