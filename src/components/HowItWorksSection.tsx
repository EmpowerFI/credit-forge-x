import { Coins, Gauge, ShoppingBag, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Coins,
    title: "1. RWA Tokenizado",
    desc: "Pool de garantia reduz o custo do crédito.",
  },
  {
    icon: Gauge,
    title: "2. Score Alternativo + Risco Social",
    desc: "Modelos tradicionais excluem boas pagadoras.",
  },
  {
    icon: ShoppingBag,
    title: "3. Marketplace + B2B BNPL",
    desc: "Marketplace comunitário com financiamento integrado.",
  },
  {
    icon: Sparkles,
    title: "4. IA Assistente pró-ativa",
    desc: "IA proativa que combate a pobreza de tempo.",
  },
];

const HowItWorksSection = () => (
  <section id="como-funciona" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Como vai funcionar</p>
        <h2 className="section-title">
          Quatro pilares técnicos da{" "}
          <span className="text-gradient">nossa arquitetura</span>
        </h2>
        <p className="section-subtitle">
          Sem jargão pesado.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="font-heading font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
