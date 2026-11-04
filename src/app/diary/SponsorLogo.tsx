import { tr } from "../i18n";
import { sponsorLogoUrl } from "./db";

/**
 * The sponsor's logo, linked to the page or product the sponsor named. It
 * opens in a new tab and carries no referrer: the sponsor learns nothing about
 * who tapped it from the tap itself.
 */
export default function SponsorLogo({ sponsor, logoPath, linkUrl, className = "h-8 max-w-[7rem]" }: {
  sponsor: string;
  logoPath: string;
  linkUrl?: string | null;
  className?: string;
}) {
  const img = (
    <img src={sponsorLogoUrl(logoPath)} alt={tr({ en: `${sponsor} logo`, pt: `Logo de ${sponsor}` })}
      className={`w-auto shrink-0 object-contain ${className}`} />
  );
  // Only an https link the database accepted is ever made clickable.
  if (!linkUrl || !/^https:\/\/\S+$/.test(linkUrl)) return img;
  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer sponsored"
      className="inline-flex shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={tr({ en: `${sponsor} (opens the sponsor's site)`, pt: `${sponsor} (abre o site do patrocinador)` })}>
      {img}
    </a>
  );
}
