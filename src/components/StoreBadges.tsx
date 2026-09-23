import { APP_STORE_URL, PLAY_STORE_URL } from "@/config/links";

interface StoreBadgesProps {
  /** Small line above each store name, e.g. "Baixe agora no" / "Download on". */
  eyebrow: string;
  /** Availability tag beside them, e.g. "Disponível no Brasil". */
  justLaunched: string;
}

/**
 * The app is published on both stores, so both are here and neither is the
 * junior one: same size, same treatment, in the order Brazil installs them.
 *
 * Framed as PROOF OF TRACTION ("the product is live, see for yourself"),
 * not as a generic user-acquisition download button.
 */
const Badge = ({ href, eyebrow, name, children }: {
  href: string;
  eyebrow: string;
  name: string;
  children: React.ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="group inline-flex items-center gap-3 rounded-xl gradient-primary px-5 py-3 shadow-glow transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
  >
    {children}
    <span className="flex flex-col text-left leading-tight">
      <span className="text-[10px] font-medium uppercase tracking-widest text-primary-foreground/80">
        {eyebrow}
      </span>
      <span className="font-heading text-base font-bold text-primary-foreground">{name}</span>
    </span>
  </a>
);

const StoreBadges = ({ eyebrow, justLaunched }: StoreBadgesProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
    <Badge href={PLAY_STORE_URL} eyebrow={eyebrow} name="Google Play">
      {/* Google Play glyph */}
      <svg viewBox="0 0 512 512" width="26" height="26" aria-hidden="true" className="shrink-0">
        <path fill="#fff" d="M48 59.49v393a4.33 4.33 0 0 0 7.37 3.07L260 256 55.37 56.42A4.33 4.33 0 0 0 48 59.49Z" opacity=".9" />
        <path fill="#fff" d="m345.8 174 L89.22 32.61l-.16-.09c-4.42-2.43-8.62 3.55-5 7.13L260 208Z" opacity=".7" />
        <path fill="#fff" d="m84.08 472.34c-3.64 3.58.56 9.56 5 7.13l.16-.09L345.8 338 260 304Z" opacity=".7" />
        <path fill="#fff" d="m449.38 231.91-71.65-39.36L286.5 256l91.23 63.45 71.65-39.36c19.49-10.77 19.49-37.41 0-48.18Z" opacity=".95" />
      </svg>
    </Badge>

    <Badge href={APP_STORE_URL} eyebrow={eyebrow} name="App Store">
      {/* Apple glyph */}
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="shrink-0">
        <path fill="#fff" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    </Badge>

    <span className="inline-flex w-fit items-center gap-1.5 rounded-full glow-border px-3 py-1.5 text-xs font-medium text-accent">
      <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
      {justLaunched} 🇧🇷
    </span>
  </div>
);

export default StoreBadges;
