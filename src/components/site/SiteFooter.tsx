import { Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import { CONTACT_EMAIL, INSTAGRAM_URL, LINKEDIN_URL, X_URL } from "@/config/links";
import { Mark } from "./editorial";

export interface FooterColumn {
  title: string;
  links: { label: string; to?: string; href?: string }[];
}

interface SiteFooterProps {
  home: string;
  tagline: string;
  /** The positioning line, set in capitals under the tagline. */
  positioning: string;
  columns: FooterColumn[];
  /** The prototype notice and the not-an-offer notice, in this language. */
  notices: string[];
  rights: string;
}

/**
 * The footer both home pages share. It was two near-identical files; the only
 * thing that ever differed between them was the words, so now that is the only
 * thing either one passes in.
 */
const SiteFooter = ({ home, tagline, positioning, columns, notices, rights }: SiteFooterProps) => (
  <footer className="border-t border-foreground/15 px-4 pb-14 pt-16 md:px-8">
    <div className="container mx-auto">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:gap-10">
        <div>
          <Link to={home} className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background">
            <Mark size={34} className="shrink-0" />
            <span className="font-heading text-2xl lg:text-[1.75rem]">EmpowerFI</span>
          </Link>
          <p className="mt-5 max-w-md leading-relaxed text-foreground/85">{tagline}</p>
          <p className="label-ui mt-5 text-foreground/70">{positioning}</p>

          <div className="mt-6 flex items-center gap-5">
            <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)"
              className="flex h-10 w-10 items-center justify-center -ml-2.5 rounded-sm text-foreground/70 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
              className="flex h-10 w-10 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Linkedin size={18} aria-hidden />
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Instagram size={18} aria-hidden />
            </a>
          </div>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="eyebrow">{col.title}</p>
            <ul className="mt-4">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent">{l.label}</Link>
                  ) : (
                    <a href={l.href} className="flex min-h-[2.5rem] items-center text-[1.0625rem] text-foreground/85 transition-colors hover:text-accent">{l.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-14 grid gap-6 border-t border-foreground/15 pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
        <div className="max-w-4xl space-y-2 text-sm leading-relaxed text-foreground/70">
          {notices.map((n) => <p key={n}>{n}</p>)}
        </div>
        <p className="text-sm text-foreground/70">© {new Date().getFullYear()} EmpowerFI. {rights}</p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
