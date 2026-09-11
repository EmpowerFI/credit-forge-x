import { useState } from "react";
import { Languages, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Anchors are written absolute ("/#impact") so the nav works identically from
// /investors and the legal routes. ScrollToTop performs the scroll.
const navLinks = [
  { label: "Home", to: "/" },
  { label: "How It Works", to: "/#how-it-works" },
  { label: "Readiness", to: "/#readiness" },
  { label: "Pilot", to: "/#pilot" },
  { label: "For Entrepreneurs", to: "/#for-entrepreneurs" },
  { label: "For Partners", to: "/#for-partners" },
  { label: "Investors", to: "/investors" },
  { label: "About", to: "/about" },
];

const NavbarEn = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 glass">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link to="/" className="font-heading text-xl font-bold text-gradient">
          EmpowerFI
        </Link>

        <div className="hidden items-center gap-6 xl:flex">
          {navLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm transition-colors hover:text-foreground ${
                pathname === to ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/pt"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Languages size={14} /> PT
          </Link>
          <Button
            asChild
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/investors#waitlist">Investor Waitlist</Link>
          </Button>
        </div>

        <button
          className="text-foreground xl:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-5 glass xl:hidden">
          {navLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
          <Link
            to="/pt"
            onClick={() => setOpen(false)}
            className="block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Português
          </Link>
          <Button
            asChild
            className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/investors#waitlist" onClick={() => setOpen(false)}>
              Investor Waitlist
            </Link>
          </Button>
        </div>
      )}
    </nav>
  );
};

export default NavbarEn;
