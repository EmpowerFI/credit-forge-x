import { useState } from "react";
import { Languages, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "O problema", href: "#problema" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Crédito produtivo", href: "#credito-produtivo" },
  { label: "O app", href: "#app" },
  { label: "Contato", href: "#contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 glass">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link to="/pt" className="font-heading text-xl font-bold text-gradient">
          EmpowerFI
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          {/* Rota, não âncora: os outros links saltam dentro desta página. */}
          <Link
            to="/pt/sobre"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sobre
          </Link>
          {/* O site institucional — e a página de investidores — vivem em inglês. */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Languages size={14} /> EN
          </Link>
        </div>

        <button
          className="text-foreground lg:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-4 glass lg:hidden">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/pt/sobre"
            onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sobre
          </Link>
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            English
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
