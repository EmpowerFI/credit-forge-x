import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Mark } from "./editorial";

export interface HeaderLink {
  label: string;
  to: string;
  /** Shown in the desktop row as well as in the panel. The rest are panel-only. */
  top?: boolean;
}

interface SiteHeaderProps {
  home: string;
  lang: "en" | "pt";
  links: HeaderLink[];
  /** The other language: a toggle in the desktop row, a named entry in the
   *  panel — "EN · PT" reads as a control beside other controls and as a
   *  riddle in a list of section names. */
  other: { label: string; panelLabel: string; to: string };
  /** The one gold-ruled action in the header. */
  primary: { label: string; to: string };
  appLabel: string;
  menuLabel: string;
}

/**
 * The header both languages share (founder's reference, 24 Sep): mark and
 * wordmark on a hairline, the sections in a row from lg up, and the same
 * entries in a panel below that width.
 *
 * The menu button used to show at every width. The reference draws the row, so
 * the row is back on desktop — a partner scanning the page should not have to
 * open something to find out what is on it.
 */
const SiteHeader = ({ home, lang, links, other, primary, appLabel, menuLabel }: SiteHeaderProps) => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = () => setOpen(false);

  const quiet = "text-foreground/85 transition-colors hover:text-accent";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-foreground/15 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-[4.25rem] items-center justify-between gap-6 px-4 md:px-8 xl:h-24">
        <Link to={home} className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background">
          <Mark size={30} className="shrink-0" />
          <span className="font-heading text-2xl tracking-[0.01em] xl:text-[1.75rem]">EmpowerFI</span>
        </Link>

        <nav aria-label={menuLabel} className="hidden items-center gap-7 xl:flex">
          {links.filter((l) => l.top).map((l) => (
            <Link key={l.to} to={l.to} aria-current={pathname === l.to ? "page" : undefined} className={`${quiet} whitespace-nowrap text-[1.0625rem]`}>
              {l.label}
            </Link>
          ))}
          <Link to={other.to} className="label-ui whitespace-nowrap text-foreground/60 transition-colors hover:text-accent">{other.label}</Link>
          <Link to={`/app?lang=${lang}`} className="btn-site !min-h-[2.875rem] !px-5 !text-[1.0625rem]">
            {appLabel} <ArrowUpRight size={15} className="text-accent" aria-hidden />
          </Link>
          <Link to={primary.to} className="btn-site btn-site-primary !min-h-[2.875rem] !px-5 !text-[1.0625rem]">{primary.label}</Link>
        </nav>

        {/* Narrow screens carry the mark, the wordmark and one control — the
            app link moves into the panel rather than wrapping onto two lines
            beside it. */}
        <div className="flex items-center xl:hidden">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-menu" aria-label={menuLabel}
            className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-sm border border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background">
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
            {[...links, { to: other.to, label: other.panelLabel }].map((l) => (
              <Link key={l.to} to={l.to} onClick={close}
                aria-current={pathname === l.to ? "page" : undefined}
                className={`flex min-h-[3rem] items-center text-[1.0625rem] ${quiet}`}>
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-5">
              <Link to={`/app?lang=${lang}`} onClick={close} className="btn-site w-full">
                {appLabel} <ArrowUpRight size={15} className="text-accent" aria-hidden />
              </Link>
              <Link to={primary.to} onClick={close} className="btn-site btn-site-primary w-full">{primary.label}</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
