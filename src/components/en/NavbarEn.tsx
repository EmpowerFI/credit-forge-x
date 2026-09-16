import { useState } from "react";
import { Menu, X } from "lucide-react";
import LaunchAppButton from "@/components/LaunchAppButton";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Anchors are written absolute ("/#impact") so the nav works identically from
// /investors and the legal routes. ScrollToTop performs the scroll.
const navLinks = [
  { label: "Home", to: "/" },
  { label: "How It Works", to: "/#how-it-works" },
  { label: "Readiness", to: "/#readiness" },
  { label: "Capital", to: "/#capital-rail" },
  { label: "Pilot", to: "/#pilot" },
  { label: "For Entrepreneurs", to: "/#for-entrepreneurs" },
  { label: "For Partners", to: "/#for-partners" },
  { label: "Investors", to: "/investors" },
  { label: "About", to: "/about" },
];

// The menu button shows at every width, by the founder's choice: a panel reads
// cleaner than a row of header links and keeps every section one click away.
const NavbarEn = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 glass">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link to="/" className="font-heading text-xl font-bold text-gradient">
          EmpowerFI
        </Link>

        <div className="flex items-center gap-3">
          <LaunchAppButton />
          <button
            className="text-foreground"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label="Menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        // Inner container lines the entries up under the logo on wide screens.
        <div id="site-menu" className="border-t border-border glass">
          <div className="container mx-auto px-4 pb-5">
            {navLinks.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                aria-current={pathname === to ? "page" : undefined}
                className={`block py-3 text-sm transition-colors hover:text-foreground ${
                  pathname === to ? "text-foreground" : "text-muted-foreground"
                }`}
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
              className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <Link to="/investors#waitlist" onClick={() => setOpen(false)}>
                Investor Waitlist
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default NavbarEn;
