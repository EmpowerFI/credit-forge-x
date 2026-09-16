import { useState } from "react";
import { Menu, X } from "lucide-react";
import LaunchAppButton from "@/components/LaunchAppButton";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "O problema", href: "/pt#problema" },
  { label: "Como funciona", href: "/pt#como-funciona" },
  { label: "Crédito produtivo", href: "/pt#credito-produtivo" },
  { label: "O app", href: "/pt#app" },
  { label: "Contato", href: "/pt#contato" },
];

// Botão de menu em qualquer largura, por escolha da fundadora: o painel fica
// mais limpo que uma fileira de links no cabeçalho.
const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 glass">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link to="/pt" className="font-heading text-xl font-bold text-gradient">
          EmpowerFI
        </Link>

        <div className="flex items-center gap-3">
          <LaunchAppButton lang="pt" />
          <button
            className="text-foreground"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="menu-site"
            aria-label="Menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        // O container interno alinha os itens com o logo em telas largas.
        <div id="menu-site" className="border-t border-border glass">
          <div className="container mx-auto px-4 pb-4">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                onClick={() => setOpen(false)}
                className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/pt/sobre"
              onClick={() => setOpen(false)}
              className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sobre
            </Link>
            <Link
              to="/pt/investidores"
              onClick={() => setOpen(false)}
              className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Investidores
            </Link>
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              English
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
