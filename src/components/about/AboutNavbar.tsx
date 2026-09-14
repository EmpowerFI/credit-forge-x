import { useState } from "react";
import { Languages, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { AboutContent } from "@/content/about";

interface AboutNavbarProps {
  nav: AboutContent["nav"];
  /** Home route for this language. */
  homePath: string;
  /** The same /about page in the other language. */
  langSwitchPath: string;
}

const AboutNavbar = ({ nav, homePath, langSwitchPath }: AboutNavbarProps) => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to={homePath} className="text-xl font-bold font-heading text-gradient">
          EmpowerFI
        </Link>

        {/* Nine entries only fit from lg up; tablets get the menu button. */}
        <div className="hidden lg:flex items-center gap-8">
          {nav.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            to={homePath}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {nav.home}
          </Link>
          <Link
            to={langSwitchPath}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          >
            <Languages size={14} /> {nav.langSwitch}
          </Link>
        </div>

        <button
          className="lg:hidden text-foreground"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden glass border-t border-border px-4 pb-4">
          {nav.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            to={homePath}
            onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {nav.home}
          </Link>
          <Link
            to={langSwitchPath}
            onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {nav.langSwitch}
          </Link>
        </div>
      )}
    </nav>
  );
};

export default AboutNavbar;
