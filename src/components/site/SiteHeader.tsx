import { useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Mark } from "./editorial";
import LanguageToggle, { type Language } from "./LanguageToggle";

export interface HeaderLink {
  label: string;
  to: string;
  /**
   * Where this link shows in the bar. "lg" is the short row a 1024px laptop
   * gets; "xl" joins it once there is room. Everything else is panel-only.
   */
  top?: "lg" | "xl";
}

interface SiteHeaderProps {
  home: string;
  lang: "en" | "pt";
  links: HeaderLink[];
  language: Language;
  /** The one gold-ruled action in the header. */
  primary: { label: string; to: string };
  appLabel: string;
  menuLabel: string;
}

/**
 * The header both languages share.
 *
 * The row of sections starts at lg rather than xl (founder, 25 Sep: below that
 * the bar was a wordmark and one square button, and nothing said what was on
 * the page). Three sections and the primary action fit a 1024px laptop; the
 * rest of the row arrives at xl. The language toggle is never inside the menu.
 */
const SiteHeader = ({ home, lang, links, language, primary, appLabel, menuLabel }: SiteHeaderProps) => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = () => setOpen(false);

  const quiet = "text-foreground/85 transition-colors hover:text-accent";
  const top = links.filter((l) => l.top);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-foreground/15 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-[4.25rem] items-center justify-between gap-4 px-4 md:px-8 lg:gap-6 xl:h-24">
        <Link to={home} aria-label="EmpowerFI" className="flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background">
          <Mark size={30} className="shrink-0" />
          {/* On a phone the mark alone: the platform needs the room in the bar. */}
          <span className="hidden font-heading text-2xl tracking-[0.01em] sm:inline xl:text-[1.75rem]">EmpowerFI</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-6">
          <nav aria-label={menuLabel} className="hidden items-center gap-6 lg:flex">
            {top.map((l) => (
              <Link key={l.to} to={l.to} aria-current={pathname === l.to ? "page" : undefined}
                className={`${quiet} whitespace-nowrap text-base xl:text-[1.0625rem] ${l.top === "xl" ? "hidden xl:inline" : ""}`}>
                {l.label}
              </Link>
            ))}
            {/* The platform, at every width (founder, 8 Nov: hidden below xl,
                nobody found the showroom). */}
            <Link to={`/app/missions?lang=${lang}`} className="btn-site !min-h-[2.75rem] !px-4 !text-base xl:!min-h-[2.875rem] xl:!px-5 xl:!text-[1.0625rem]">
              {appLabel} <ArrowUpRight size={15} className="text-accent" aria-hidden />
            </Link>
            <Link to={primary.to} className="btn-site btn-site-primary !min-h-[2.75rem] !px-5 !text-base xl:!min-h-[2.875rem] xl:!text-[1.0625rem]">
              {primary.label}
            </Link>
          </nav>

          {/* Below lg the row has no nav: the platform still sits in the bar. */}
          <Link to={`/app/missions?lang=${lang}`}
            className="btn-site !min-h-[2.75rem] !gap-1 !px-3 !text-[0.9375rem] lg:!hidden">
            {appLabel} <ArrowUpRight size={14} className="text-accent" aria-hidden />
          </Link>

          <LanguageToggle language={language} />

          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-menu" aria-label={menuLabel}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-sm border border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background xl:hidden">
            {open ? <X size={18} aria-hidden /> : (
              <>
                <span className="h-[1.5px] w-[18px] bg-foreground" aria-hidden />
                <span className="h-[1.5px] w-[18px] bg-foreground" aria-hidden />
                <span className="h-[1.5px] w-[18px] bg-gold" aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" className="border-t border-foreground/15 bg-background xl:hidden">
          <div className="container mx-auto divide-y divide-foreground/12 px-4 pb-5 md:px-8">
            {[...links, { to: language.to, label: language.otherName }].map((l) => (
              <Link key={l.to} to={l.to} onClick={close}
                aria-current={pathname === l.to ? "page" : undefined}
                className={`flex min-h-[3rem] items-center text-[1.0625rem] ${quiet}`}>
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-5">
              <Link to={`/app/missions?lang=${lang}`} onClick={close} className="btn-site w-full">
                {appLabel} <ArrowUpRight size={15} className="text-accent" aria-hidden />
              </Link>
              <Link to={primary.to} onClick={close} className="btn-site btn-site-primary w-full lg:hidden">{primary.label}</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
