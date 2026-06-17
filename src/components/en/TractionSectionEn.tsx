import { Smartphone, Award, ExternalLink } from "lucide-react";
import { PLAY_STORE_URL } from "@/config/links";

const items = [
  {
    icon: Smartphone,
    title: "Marketplace live on Google Play",
    desc: "The product is published and running. Not a mockup or a prototype: you can download and use it today.",
    href: PLAY_STORE_URL,
    linkLabel: "View on Google Play",
  },
  {
    icon: Award,
    title: "Field validation with Sebrae",
    desc: "Thesis validated in the field with Sebrae and currently in the Sebrae Ginga Prototipa accelerator — one of Brazil's leading innovation references.",
  },
];

const TractionSectionEn = () => (
  <section id="traction" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Traction</p>
        <h2 className="section-title">
          What's already{" "}
          <span className="text-gradient">real and verifiable</span>
        </h2>
        <p className="section-subtitle">
          No inflated numbers. Everything here can be checked.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {items.map(({ icon: Icon, title, desc, href, linkLabel }) => (
          <div key={title} className="glass rounded-2xl p-8 glow-border flex flex-col">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="text-lg font-heading font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed flex-1">{desc}</p>
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-foreground transition-colors">
                {linkLabel} <ExternalLink size={14} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TractionSectionEn;
