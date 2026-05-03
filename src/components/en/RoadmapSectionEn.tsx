import { CheckCircle2 } from "lucide-react";

const current = [
  "Thesis validated through primary research (interviews with entrepreneurs via Sebrae)",
  "Accelerated by Sebrae — Ginga Prototipa Program",
  "Clickable prototype tested with beta testers",
  "Deep technical work on blockchain architecture (Solana, RWA)",
  "Building a network of investors and institutional partners",
];

const phases = [
  { phase: "Phase 1", horizon: "Next 6 months", title: "Technical MVP and validation", desc: "Solana hackathon, technical MVP of the score and copilot, technical validation of the tokenized architecture." },
  { phase: "Phase 2", horizon: "6–12 months", title: "Pre-seed and first issuance", desc: "Pre-seed round, partnership with a tokenization platform, first tokenized issuance backed by Treasury." },
  { phase: "Phase 3", horizon: "12–24 months", title: "Real credit origination", desc: "Live origination, first customers, initial default and unit economics metrics." },
  { phase: "Phase 4", horizon: "24+ months", title: "Scale and internalization", desc: "Base scaling, product expansion and internalization of the tokenization layer." },
];

const RoadmapSectionEn = () => (
  <section id="roadmap" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Roadmap</p>
        <h2 className="section-title">Built <span className="text-gradient">step by step</span></h2>
      </div>

      <div className="glass rounded-2xl p-8 glow-border shadow-glow max-w-3xl mx-auto space-y-5">
        <p className="text-sm font-medium text-accent uppercase tracking-widest text-center">Where we are today</p>
        <ul className="space-y-3">
          {current.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <CheckCircle2 className="text-accent shrink-0 mt-0.5" size={20} />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center pt-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Next phases</p>
      </div>

      <div className="relative">
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-accent/30 to-transparent" />
        <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-8">
          {phases.map(({ phase, horizon, title, desc }, i) => (
            <div key={phase} className={`${i % 2 === 1 ? "md:mt-16" : ""}`}>
              <div className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-accent">{phase}</span>
                  <span className="text-xs font-mono text-muted-foreground">{horizon}</span>
                </div>
                <h3 className="text-lg font-heading font-bold text-foreground mt-1">{title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default RoadmapSectionEn;
