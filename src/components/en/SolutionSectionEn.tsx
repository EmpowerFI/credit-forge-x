import { Activity, Percent, Bot } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Smart business analysis",
    desc: "We will connect via Open Finance and analyze real cash flow — card terminal, Pix, bank account. Transactional behavior matters more than a bureau score.",
  },
  {
    icon: Percent,
    title: "Rates that make sense",
    desc: "Model designed for rates significantly below today's overdraft and revolving credit, enabled by tokenized capital.",
  },
  {
    icon: Bot,
    title: "More than a loan, a copilot",
    desc: "Entrepreneurs will get an AI-powered business diagnosis, prioritized recommendations and support to renegotiate debt and organize finances. In adaptive micro-sessions.",
  },
];

const SolutionSectionEn = () => (
  <section id="solution" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">The Solution</p>
        <h2 className="section-title">
          Our <span className="text-gradient">technical thesis</span>
        </h2>
        <p className="section-subtitle">
          Four pillars being built to solve the problem above.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-8 glow-border hover:shadow-glow transition-all duration-300 group">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 group-hover:animate-float">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SolutionSectionEn;
