import { AlertTriangle, XCircle, TrendingDown, Ban } from "lucide-react";

const problems = [
  { icon: Ban, text: "Variable income is not considered" },
  { icon: XCircle, text: "No formal banking history, no credit" },
  { icon: TrendingDown, text: "Risk models stuck on credit bureau data" },
  { icon: AlertTriangle, text: "Abusive rates for those who need it most" },
];

const ProblemSectionEn = () => (
  <section id="problem" className="section-padding gradient-subtle">
    <div className="container mx-auto text-center space-y-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">The Problem</p>
        <h2 className="section-title">
          Banks analyze your past.{" "}
          <span className="text-gradient">We are building something that analyzes your business.</span>
        </h2>
        <p className="section-subtitle">
          Microentrepreneurs generate revenue every day and still hear "no" — or get charged overdraft-level rates.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {problems.map(({ icon: Icon, text }) => (
          <div key={text} className="glass rounded-xl p-6 text-left glow-border">
            <Icon className="text-destructive mb-4" size={24} />
            <p className="text-foreground font-medium">{text}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-8 glow-border max-w-2xl mx-auto">
        <p className="text-xl md:text-2xl font-heading font-bold text-foreground">
          A reliable payer treated as{" "}
          <span className="text-gradient">high risk.</span>{" "}
          That's the gap we're addressing.
        </p>
      </div>
    </div>
  </section>
);

export default ProblemSectionEn;
