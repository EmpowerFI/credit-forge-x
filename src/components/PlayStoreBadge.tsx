import { PLAY_STORE_URL } from "@/config/links";

interface PlayStoreBadgeProps {
  /** Small line above the store name, e.g. "Ao vivo no" / "Live on". */
  eyebrow: string;
  /** "Just launched" tag text, e.g. "Acabou de lançar". */
  justLaunched: string;
}

/**
 * Launch-announcement badge for the live Google Play listing.
 * This is framed as PROOF OF TRACTION ("the product is live, see for yourself"),
 * not a generic user-acquisition download button.
 */
const PlayStoreBadge = ({ eyebrow, justLaunched }: PlayStoreBadgeProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-3 rounded-xl gradient-primary px-5 py-3 shadow-glow transition-transform duration-300 hover:scale-[1.02]"
    >
      {/* Google Play glyph */}
      <svg viewBox="0 0 512 512" width="26" height="26" aria-hidden="true" className="shrink-0">
        <path fill="#fff" d="M48 59.49v393a4.33 4.33 0 0 0 7.37 3.07L260 256 55.37 56.42A4.33 4.33 0 0 0 48 59.49Z" opacity=".9" />
        <path fill="#fff" d="m345.8 174 L89.22 32.61l-.16-.09c-4.42-2.43-8.62 3.55-5 7.13L260 208Z" opacity=".7" />
        <path fill="#fff" d="m84.08 472.34c-3.64 3.58.56 9.56 5 7.13l.16-.09L345.8 338 260 304Z" opacity=".7" />
        <path fill="#fff" d="m449.38 231.91-71.65-39.36L286.5 256l91.23 63.45 71.65-39.36c19.49-10.77 19.49-37.41 0-48.18Z" opacity=".95" />
      </svg>
      <span className="flex flex-col text-left leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-widest text-primary-foreground/80">
          {eyebrow}
        </span>
        <span className="font-heading text-base font-bold text-primary-foreground">
          Google Play
        </span>
      </span>
    </a>

    <span className="inline-flex w-fit items-center gap-1.5 rounded-full glow-border px-3 py-1.5 text-xs font-medium text-accent">
      <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
      {justLaunched} 🇧🇷
    </span>
  </div>
);

export default PlayStoreBadge;
