import { Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import { CONTACT_EMAIL, INSTAGRAM_URL, LINKEDIN_URL, X_URL } from "@/config/links";

const siteLinks = [
  { label: "How It Works", to: "/#how-it-works" },
  { label: "Readiness", to: "/#readiness" },
  { label: "Business Model", to: "/#business-model" },
  { label: "Impact", to: "/#impact" },
  { label: "For Entrepreneurs", to: "/#for-entrepreneurs" },
  { label: "For Partners", to: "/#for-partners" },
  { label: "Investors", to: "/investors" },
];

const companyLinks = [
  { label: "About", to: "/about" },
  { label: "Sources", to: "/sources" },
  { label: "Terms", to: "/terms" },
  { label: "Privacy", to: "/privacy" },
  { label: "Português", to: "/pt" },
];

const FooterEn = () => (
  <footer className="border-t border-border px-4 py-12">
    <div className="container mx-auto flex flex-col gap-10">
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Link to="/" className="font-heading text-lg font-bold text-gradient">
            EmpowerFI
          </Link>
          <p className="max-w-sm text-sm text-muted-foreground">
            Credit infrastructure for the next generation of entrepreneurs — turning global
            liquidity into productive capital, starting in Brazil.
          </p>

          <div className="flex items-center gap-5 pt-1">
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Linkedin size={18} />
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Instagram size={18} />
            </a>
          </div>
        </div>

        <nav className="flex flex-col gap-3 text-sm" aria-label="Site">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">Site</p>
          {siteLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>

        <nav className="flex flex-col gap-3 text-sm" aria-label="Company">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">Company</p>
          {companyLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Contact
          </a>
        </nav>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-xs text-muted-foreground">
          EmpowerFI is not offering securities, investment products or accepting investor
          funds through this website. Nothing here is an offer to sell or a solicitation to
          buy any financial instrument, and no return is promised or implied.
        </p>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} EmpowerFI. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

export default FooterEn;
