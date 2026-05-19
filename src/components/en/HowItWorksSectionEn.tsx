import { Coins, Gauge, ShoppingBag, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Coins,
    title: "1. Tokenized RWA",
    desc: "Collateral pool reduces the cost of credit.",
  },
  {
    icon: Gauge,
    title: "2. Alternative Score + Social Risk",
    desc: "Traditional models exclude reliable payers.",
  },
  {
    icon: ShoppingBag,
    title: "3. Marketplace + B2B BNPL",
    desc: "Community marketplace with integrated financing.",
  },
  {
    icon: Sparkles,
    title: "4. Proactive AI Assistant",
    desc: "Proactive AI that fights time poverty.",
  },
];

const HowItWorksSectionEn = () => (
  <section id="how-it-works" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">How it will work</p>
        <h2 className="section-title">
          Four technical pillars of{" "}
          <span className="text-gradient">our architecture</span>
        </h2>
        <p className="section-subtitle">
          No heavy jargon.
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

export default HowItWorksSectionEn;
