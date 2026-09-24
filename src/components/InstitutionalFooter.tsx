import { Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import { Mark } from "@/components/site/editorial";
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

// The prototype disclaimer and the not-an-offer notice, word for word from the
// positioning brief. They live here rather than in the footer dictionaries
// because the legal pages feed this footer from their own content too.
const notices = {
  "pt-BR": [
    "Protótipo de uma futura arquitetura regulada de crédito produtivo P2P. Investimentos, retornos, câmbio e liquidação via Pix do hackathon são simulados; as transações em blockchain usam ativos de teste na Devnet.",
    "Nada neste site é oferta de valores mobiliários ou de produto financeiro. Entrar na lista de espera é uma manifestação de interesse, sem compromisso.",
  ],
  en: [
    "Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.",
    "Nothing on this site is an offer of securities or of a financial product. Joining a waitlist is a non-binding expression of interest.",
  ],
} as const;

/**
 * Footer for the institutional routes. Unlike the home footer, this one names
 * the legal entity, its address and its tax ID — the questions an app-store
 * reviewer or a partner needs answered without having to ask.
 */
const InstitutionalFooter = ({ footer, homePath, lang }: InstitutionalFooterProps) => {
  const pt = lang === "pt-BR";
  const privacyPath = pt ? "/privacidade" : "/privacy";
  const termsPath = pt ? "/termos" : "/terms";

  return (
  <footer className="border-t border-foreground/15 px-4 pb-14 pt-16 md:px-8">
    <div className="container mx-auto flex flex-col gap-10">
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Link to={homePath} className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background">
            <Mark size={34} className="shrink-0" />
            <span className="font-heading text-2xl">EmpowerFI</span>
          </Link>
          <p className="max-w-md leading-relaxed text-foreground/85">{footer.tagline}</p>

          <div className="flex items-center gap-5 pt-1">
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent"
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
              className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent"
            >
              <Linkedin size={18} />
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent"
            >
              <Instagram size={18} />
            </a>
          </div>
        </div>

        <address className="not-italic space-y-2 text-[1.0625rem] text-foreground/80">
          <p className="eyebrow">{footer.developedBy}</p>
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
          <Link to={privacyPath} className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent">
            {footer.privacy}
          </Link>
          <Link to={termsPath} className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent">
            {footer.terms}
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent"
          >
            {footer.contact}
          </a>
          <Link to={homePath} className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent">
            {footer.backToHome}
          </Link>
        </nav>
      </div>

      <div className="space-y-2 border-t border-foreground/15 pt-6 text-sm leading-relaxed text-foreground/70">
        {notices[lang].map((notice) => (
          <p key={notice}>{notice}</p>
        ))}
        <p>
          © {new Date().getFullYear()} EmpowerFI. {footer.rights}
        </p>
      </div>
    </div>
  </footer>
  );
};

export default InstitutionalFooter;
