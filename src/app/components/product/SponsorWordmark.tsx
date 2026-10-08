import { tr } from "../../i18n";

/**
 * A sponsor's wordmark, drawn rather than fetched: no logo file, no remote
 * request, nothing that could be mistaken for a real company's asset.
 *
 * The mark is a plain geometric wordmark — an arc over the letters, which reads
 * as a rising curve — chosen to look like a corporate mark without resembling
 * any particular one. It carries its own colours rather than the product's
 * accent, because a sponsor's brand should read as a guest on the page and not
 * as EmpowerFI's own.
 *
 * **Only for an invented sponsor.** The whole component manufactures branding,
 * so pointing it at a real organisation's name would be inventing that
 * organisation's logo — a worse claim than naming it, and one a reader has no
 * way to see through. Every call site is guarded by `!dressing.hypothetical`
 * (see `lib/sponsorship.ts`), which is why nothing renders it today: the demo's
 * sponsor is a real foundation named as a hypothesis, and it is set in the
 * page's own type instead. The component stays for the next invented one.
 */
export default function SponsorWordmark({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 132 32" className={className} role="img"
      aria-label={tr({ en: `${name}, the program's sponsor`, pt: `${name}, patrocinadora do programa` })}>
      <title>{name}</title>
      <path d="M6 23 C 6 9, 34 9, 34 23" fill="none" stroke="#3B6FB6" strokeWidth="3" strokeLinecap="round" />
      <circle cx="34" cy="23" r="3.6" fill="#D8A33B" />
      <text x="46" y="24" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="20"
        fontWeight="700" letterSpacing="1.5" fill="currentColor">{name}</text>
    </svg>
  );
}
