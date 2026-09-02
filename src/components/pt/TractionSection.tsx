import { Smartphone, Award, ExternalLink } from "lucide-react";
import { PLAY_STORE_URL } from "@/config/links";

const items = [
  {
    icon: Smartphone,
    title: "Marketplace no ar no Google Play",
    desc: "O produto está publicado e em funcionamento. Não é mockup nem protótipo: dá para baixar e usar hoje.",
    href: PLAY_STORE_URL,
    linkLabel: "Ver no Google Play",
  },
  {
    icon: Award,
    title: "Validação de campo com o Sebrae",
    desc: "Tese validada em campo junto ao Sebrae e, atualmente, na aceleradora Sebrae Ginga Prototipa — uma das principais referências de inovação do país.",
  },
];

const TractionSection = () => (
  <section id="tracao" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Tração</p>
        <h2 className="section-title">
          O que já é{" "}
          <span className="text-gradient">real e verificável</span>
        </h2>
        <p className="section-subtitle">
          Sem números inflados. O que está aqui pode ser conferido.
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

export default TractionSection;
