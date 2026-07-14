import { Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import {
  COMPANY_CITY,
  COMPANY_CNPJ,
  COMPANY_COUNTRY,
  COMPANY_LEGAL_NAME,
} from "@/config/company";
import { CONTACT_EMAIL, INSTAGRAM_URL, LINKEDIN_URL, X_URL } from "@/config/links";
import type { AboutContent } from "@/content/about";

interface InstitutionalFooterProps {
  footer: AboutContent["footer"];
  homePath: string;
  lang: "pt-BR" | "en";
}

/**
 * Footer for the institutional routes. Unlike the home footer, this one names
 * the legal entity, its address and its tax ID — the questions an app-store
 * reviewer or a partner needs answered without having to ask.
 */
const InstitutionalFooter = ({ footer, homePath, lang }: InstitutionalFooterProps) => {
  const pt = lang === "pt-BR";
  const privacyPath = pt ? "/privacidade" : "/en/privacy";
  const termsPath = pt ? "/termos" : "/en/terms";

  return (
  <footer className="border-t border-border py-14 px-4 gradient-subtle">
    <div className="container mx-auto flex flex-col gap-10">
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Link to={homePath} className="text-lg font-heading font-bold text-gradient">
            EmpowerFI
          </Link>
          <p className="text-sm text-muted-foreground max-w-sm">{footer.tagline}</p>

          <div className="flex items-center gap-5 pt-1">
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="text-muted-foreground hover:text-foreground transition-colors"
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
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Linkedin size={18} />
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Instagram size={18} />
            </a>
          </div>
        </div>

        <address className="not-italic space-y-2 text-sm text-muted-foreground">
          <p className="text-xs uppercase tracking-widest text-accent font-medium">
            {footer.developedBy}
          </p>
          <p className="text-foreground font-medium leading-snug">{COMPANY_LEGAL_NAME}</p>
          {COMPANY_CNPJ && (
            <p>
              {footer.cnpjLabel}: {COMPANY_CNPJ}
            </p>
          )}
          <p>
            {COMPANY_CITY} – {COMPANY_COUNTRY}
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-block hover:text-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
        </address>

        <nav className="flex flex-col gap-3 text-sm">
          <Link to={privacyPath} className="text-muted-foreground hover:text-foreground transition-colors">
            {footer.privacy}
          </Link>
          <Link to={termsPath} className="text-muted-foreground hover:text-foreground transition-colors">
            {footer.terms}
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {footer.contact}
          </a>
          <Link to={homePath} className="text-muted-foreground hover:text-foreground transition-colors">
            {footer.backToHome}
          </Link>
        </nav>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-6">
        © {new Date().getFullYear()} EmpowerFI. {footer.rights}
      </p>
    </div>
  </footer>
  );
};

export default InstitutionalFooter;
