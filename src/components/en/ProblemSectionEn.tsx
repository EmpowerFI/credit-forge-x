import { Scale, Eye } from "lucide-react";

const stats = [
  { value: "29%", label: "of business credit goes to women — who run ~40% of operations" },
  { value: "68%", label: "of women entrepreneurs have credit requests denied or only partially met" },
  { value: "=", label: "same default rate as men — yet they pay higher interest" },
];

const failures = [
  {
    icon: Scale,
    title: "Credit ignores who keeps the economy running",
    desc: "Women run about 40% of operations but receive only ~29% of business credit — at the same default rate and higher interest. With no formal banking history, they stay invisible to risk models.",
  },
  {
    icon: Eye,
    title: "Impact capital can't see where it lands",
    desc: "Impact funds have no verifiable, real-time proof of where money actually goes. Measurement is annual, self-reported and hard to audit — which stalls serious capital allocation.",
  },
];

const ProblemSectionEn = () => (
  <section id="problem" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">The Problem</p>
        <h2 className="section-title">
          Two market failures,{" "}
          <span className="text-gradient">one infrastructure to fix them</span>
        </h2>
        <p className="section-subtitle">
          One side can't prove it deserves credit. The other can't prove where its capital creates impact.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {stats.map(({ value, label }) => (
          <div key={label} className="glass rounded-xl p-8 glow-border text-center">
            <p className="text-4xl md:text-5xl font-heading font-bold text-gradient mb-2">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {failures.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-2xl p-8 glow-border text-left">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
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

export default ProblemSectionEn;
