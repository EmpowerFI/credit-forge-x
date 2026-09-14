import { Quote } from "lucide-react";
import type { AboutContent } from "@/content/about";

const AboutPartners = ({ partners }: { partners: AboutContent["partners"] }) => (
  <section id="parceiros" className="section-padding">
    <div className="container mx-auto max-w-4xl space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">{partners.eyebrow}</p>
        <h2 className="section-title">
          {partners.titleLead}
          <span className="text-gradient">{partners.titleAccent}</span>
        </h2>
        <p className="section-subtitle">{partners.subtitle}</p>
      </div>

      <div className="space-y-6">
        {partners.testimonials.map((t) => (
          <figure
            key={t.name}
            className="glass rounded-2xl p-8 md:p-12 glow-border shadow-glow space-y-6"
          >
            <Quote className="text-accent" size={32} aria-hidden />
            <blockquote className="font-heading text-xl leading-relaxed text-foreground md:text-2xl">
              <p>{t.quote}</p>
            </blockquote>
            <figcaption className="space-y-1">
              <p className="font-heading font-bold text-foreground">{t.name}</p>
              <p className="text-sm text-accent">{t.role}</p>
              {t.note && <p className="pt-2 text-xs text-muted-foreground">{t.note}</p>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);

export default AboutPartners;
