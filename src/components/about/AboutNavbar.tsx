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

const itemClass = "py-3 text-sm text-muted-foreground hover:text-foreground transition-colors";

// The menu button shows at every width, by the founder's choice: with nine
// entries a row of header links read as clutter, and the panel keeps every
// section one click away.
const AboutNavbar = ({ nav, homePath, langSwitchPath }: AboutNavbarProps) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to={homePath} className="text-xl font-bold font-heading text-gradient">
          EmpowerFI
        </Link>

        <button
          className="text-foreground"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="about-menu"
          aria-label="Menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        // Inner container lines the entries up under the logo on wide screens.
        <div id="about-menu" className="glass border-t border-border">
          <div className="container mx-auto px-4 pb-4">
            {nav.links.map((l) => (
              <a key={l.href} href={l.href} onClick={close} className={`block ${itemClass}`}>
                {l.label}
              </a>
            ))}
            <Link to={homePath} onClick={close} className={`block ${itemClass}`}>
              {nav.home}
            </Link>
            <Link to={langSwitchPath} onClick={close} className={`flex items-center gap-1.5 ${itemClass}`}>
              <Languages size={14} /> {nav.langSwitch}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AboutNavbar;
