import { Database, Cpu, BarChart, Landmark } from "lucide-react";

const stack = [
  { icon: Database, label: "Data via Open Finance" },
  { icon: Cpu, label: "AI-driven risk modeling" },
  { icon: BarChart, label: "Proprietary score" },
  { icon: Landmark, label: "Tokenized capital backed by Treasury" },
];

const DifferentialSectionEn = () => (
  <section className="section-padding gradient-subtle">
    <div className="container mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">Differentiator</p>
          <h2 className="section-title">
            Proprietary control of the{" "}
            <span className="text-gradient">credit stack</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We are building EmpowerFI owning every layer: data collection, risk modeling, proprietary score and origination. This proprietary architecture is our main long-term competitive advantage.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Designed for those the banking system has historically failed to see: women entrepreneurs with variable income, no formal collateral, double shifts and scarce time.
          </p>
        </div>

        <div className="space-y-4">
          {stack.map(({ icon: Icon, label }, i) => (
            <div key={label} className="flex items-center gap-4 glass rounded-xl p-5 glow-border">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Icon className="text-primary-foreground" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-heading font-semibold text-foreground">{label}</p>
              </div>
              <span className="text-xs text-accent font-mono">0{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default DifferentialSectionEn;
