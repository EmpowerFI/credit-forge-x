import { Percent, ArrowLeftRight, Building2, Code2 } from "lucide-react";

const models = [
  { icon: Percent, title: "Credit spread", desc: "Projected main revenue from lending operations with fair, risk-adjusted rates." },
  { icon: ArrowLeftRight, title: "Transaction fees", desc: "Fee on financial operations processed inside the platform." },
  { icon: Building2, title: "Risk as a service", desc: "Score and modeling licensed to B2B partners with similar audiences." },
  { icon: Code2, title: "Credit APIs", desc: "Pluggable origination infrastructure for other players (CaaS)." },
];

const BusinessModelSectionEn = () => (
  <section className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Business Model</p>
        <h2 className="section-title">Our projected model of <span className="text-gradient">diversified revenue</span></h2>
        <p className="section-subtitle">Four monetization fronts designed to scale with the platform.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {models.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300 text-center">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-4">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="font-heading font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BusinessModelSectionEn;
