import { useState } from "react";
import { Menu, X, Languages } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "The problem", href: "#problem" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Difference", href: "#difference" },
  { label: "Investors", href: "#investors" },
];

const NavbarEn = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/en" className="text-xl font-bold font-heading text-gradient">EmpowerFI</Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
          {/* A route, not an anchor: the other links jump within this page. */}
          <Link to="/en/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
            <Languages size={14} /> PT
          </Link>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden glass border-t border-border px-4 pb-4">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
          <Link to="/en/about" onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
          <Link to="/" onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Português
          </Link>
        </div>
      )}
    </nav>
  );
};

export default NavbarEn;
