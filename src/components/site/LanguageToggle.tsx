import { Link } from "react-router-dom";

export interface Language {
  /** The language being read now, in two letters: "PT", "EN". */
  current: string;
  /** The other one, same form. */
  other: string;
  /** The other one named in its own words, for the panel: "Português". */
  otherName: string;
  /** Where that other version of this page lives. */
  to: string;
}

/**
 * Which language you are reading, and the other one, side by side.
 *
 * It lives in the bar at every width rather than inside the menu (founder, 25
 * Sep: "o menu era melhor porque ficava claro aonde trocar a versão do site
 * para português"). A Brazilian visitor landing on the English root should not
 * have to open anything to find Portuguese — and a single "EN · PT" link, which
 * is what this replaced, never said which of the two you were already on.
 */
const LanguageToggle = ({ language, className = "" }: { language: Language; className?: string }) => (
  <div className={`flex items-center overflow-hidden rounded-sm border border-foreground/25 ${className}`}>
    <span aria-current="true"
      className="label-ui flex min-h-[2.5rem] items-center bg-foreground/[0.06] px-2.5 text-foreground/70">
      {language.current}
    </span>
    <Link to={language.to} hrefLang={language.to.startsWith("/pt") ? "pt-BR" : "en"}
      // Gold, because everywhere else on the site gold means "you can click
      // this". Leaving the other language quieter than the one you are already
      // reading pointed the eye at the wrong half of the control.
      className="label-ui flex min-h-[2.5rem] items-center px-2.5 text-accent transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
      <span className="sr-only">{language.otherName} — </span>
      <span aria-hidden>{language.other}</span>
    </Link>
  </div>
);

export default LanguageToggle;
