import { Brain, Globe, Shield, Layers } from "lucide-react";

const techs = [
  { icon: Brain, label: "AI & Machine Learning" },
  { icon: Globe, label: "Open Finance" },
  { icon: Shield, label: "Tokenized capital" },
  { icon: Layers, label: "Proprietary score" },
];

const AboutSectionEn = () => (
  <section id="about" className="section-padding">
    <div className="container mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">About EmpowerFI</p>
          <h2 className="section-title">
            A credit fintech{" "}
            <span className="text-gradient">in development, with a validated thesis</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            EmpowerFI is being built to address a concrete gap: microentrepreneurs with variable income and no formal collateral are consistently rejected — or penalized with abusive rates — by the traditional banking system.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Our thesis combines cash-flow analysis via Open Finance, scoring based on financial behavior, AI assistance in adaptive journeys, and capital raised through tokenization. The projected outcome: substantially cheaper and more accessible credit, with economic sustainability.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {techs.map(({ icon: Icon, label }) => (
            <div key={label} className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
              <Icon className="text-accent mb-3" size={28} />
              <p className="font-heading font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">Part of our architecture</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default AboutSectionEn;
