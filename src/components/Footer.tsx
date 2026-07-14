import { Linkedin, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import { X_URL, LINKEDIN_URL, INSTAGRAM_URL, CONTACT_EMAIL } from "@/config/links";

const Footer = () => (
  <footer className="border-t border-border py-10 px-4">
    <div className="container mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="text-lg font-heading font-bold text-gradient">EmpowerFI</span>
          <p className="text-xs text-muted-foreground">Infraestrutura financeira para empreendedoras — começando pelo Brasil.</p>
        </div>

        <div className="flex items-center gap-5">
          <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)"
            className="text-muted-foreground hover:text-foreground transition-colors">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
            className="text-muted-foreground hover:text-foreground transition-colors">
            <Linkedin size={18} />
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
            className="text-muted-foreground hover:text-foreground transition-colors">
            <Instagram size={18} />
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sobre</Link>
          <Link to="/termos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Termos</Link>
          <Link to="/privacidade" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacidade</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contato</a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center md:text-left">© {new Date().getFullYear()} EmpowerFI. Todos os direitos reservados.</p>
    </div>
  </footer>
);

export default Footer;
