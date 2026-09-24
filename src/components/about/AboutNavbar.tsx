import { useState } from "react";
import { ArrowUpRight, Languages, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Mark } from "@/components/site/editorial";
import type { AboutContent } from "@/content/about";

interface AboutNavbarProps {
  nav: AboutContent["nav"];
  /** Home route for this language. */
  homePath: string;
  /** The same /about page in the other language. */
  langSwitchPath: string;
}

const itemClass = "flex min-h-[3rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent";

// The menu button shows at every width: with nine entries a row of header
// links reads as clutter, and the panel keeps every section one click away.
// The bar itself matches the site header — same mark, same wordmark, same
// hairline — so moving between /about and the home page is not a jolt.
const AboutNavbar = ({ nav, homePath, langSwitchPath }: AboutNavbarProps) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-foreground/15 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-[4.25rem] items-center justify-between gap-6 px-4 md:px-8 lg:h-24">
        <Link to={homePath} className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background">
          <Mark size={30} className="shrink-0" />
          <span className="font-heading text-2xl tracking-[0.01em] lg:text-[1.75rem]">EmpowerFI</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link to={`/app?lang=${homePath.startsWith("/pt") ? "pt" : "en"}`} className="btn-site !hidden !min-h-[2.875rem] !px-5 sm:!inline-flex">
            App · Devnet <ArrowUpRight size={15} className="text-accent" aria-hidden />
          </Link>
          <button
            type="button"
            className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-sm border border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="about-menu"
            aria-label="Menu"
          >
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
        // Inner container lines the entries up under the logo on wide screens.
        <div id="about-menu" className="border-t border-foreground/15 bg-background">
          <div className="container mx-auto divide-y divide-foreground/12 px-4 pb-5 md:px-8">
            {nav.links.map((l) => (
              <a key={l.href} href={l.href} onClick={close} className={itemClass}>
                {l.label}
              </a>
            ))}
            <Link to={homePath} onClick={close} className={itemClass}>
              {nav.home}
            </Link>
            <Link to={langSwitchPath} onClick={close} className={`gap-2 ${itemClass}`}>
              <Languages size={15} aria-hidden /> {nav.langSwitch}
            </Link>
            <Link to={`/app?lang=${homePath.startsWith("/pt") ? "pt" : "en"}`} onClick={close} className={`gap-2 sm:hidden ${itemClass}`}>
              App · Devnet <ArrowUpRight size={15} className="text-accent" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AboutNavbar;
