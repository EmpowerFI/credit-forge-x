import { ExternalLink } from "lucide-react";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/config/links";

/**
 * Both store listings as inline links, for the cards that offer the app as
 * evidence rather than as a download. One link would quietly pick a platform
 * for the reader; these do not.
 */
const StoreLinks = ({ className = "" }: { className?: string }) => (
  <span className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
    {[["Google Play", PLAY_STORE_URL], ["App Store", APP_STORE_URL]].map(([label, href]) => (
      <a key={label} href={href} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[1.0625rem] text-accent underline-offset-4 hover:underline">
        {label} <ExternalLink size={14} aria-hidden />
      </a>
    ))}
  </span>
);

export default StoreLinks;
