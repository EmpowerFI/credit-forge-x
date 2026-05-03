import { Link2, Gauge, Coins, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "1. Open Finance connection",
    desc: "Entrepreneurs will authorize access to business data (card terminal, Pix, bank account) in a few clicks, within the framework regulated by the Central Bank of Brazil.",
  },
  {
    icon: Gauge,
    title: "2. Behavior-based score",
    desc: "Our model will read real cash flow and compute a proprietary score. The architecture does not depend on credit bureaus to identify reliable payers.",
  },
  {
    icon: Coins,
    title: "3. Tokenized capital backed by Treasury",
    desc: "Funding will come from investors via a tokenized structure backed by Brazilian Treasury bonds — designed to substantially reduce the cost of credit.",
  },
  {
    icon: Sparkles,
    title: "4. AI-powered copilot",
    desc: "The journey will include business diagnosis, prioritized recommendations and support to renegotiate debt and organize finances.",
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
