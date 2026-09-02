import { useState } from "react";
import { Menu, X, Languages } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "O problema", href: "#problema" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Diferencial", href: "#diferencial" },
  { label: "Investidores", href: "#investidores" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/pt" className="text-xl font-bold font-heading text-gradient">EmpowerFI</Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
          {/* A route, not an anchor: the other links jump within this page. */}
          <Link to="/pt/sobre" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sobre
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
            <Languages size={14} /> EN
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
          <Link to="/pt/sobre" onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sobre
          </Link>
          <Link to="/" onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            English
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
