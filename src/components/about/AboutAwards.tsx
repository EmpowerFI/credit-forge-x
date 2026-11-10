import { ExternalLink, Trophy } from "lucide-react";
import type { AboutContent } from "@/content/about";

/** The awards EmpowerFI won, each linking to the listing that shows it. */
const AboutAwards = ({ awards }: { awards: AboutContent["awards"] }) => (
  <section id="premios" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{awards.eyebrow}</p>
        <h2 className="section-title">
          {awards.titleLead}
          <span className="text-gradient">{awards.titleAccent}</span>
        </h2>
        <p className="section-subtitle">{awards.subtitle}</p>
      </div>

      <ul className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {awards.items.map(({ place, title, by, desc, prize, href, linkLabel }) => (
          <li key={title} className="glass rounded-2xl p-8 glow-border flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Trophy className="text-primary-foreground" size={24} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">{place}</p>
                <p className="text-sm text-muted-foreground">{prize}</p>
              </div>
            </div>
            <h3 className="text-lg font-heading font-bold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{by}</p>
            <p className="mt-3 text-muted-foreground leading-relaxed flex-1">{desc}</p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-foreground transition-colors"
            >
              {linkLabel} <ExternalLink size={14} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default AboutAwards;
