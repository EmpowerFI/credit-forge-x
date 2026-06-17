import { Network, Gauge, ShieldCheck } from "lucide-react";

const intersection = [
  "MEI marketplace",
  "Invisible alternative score",
  "On-chain RWA capital",
  "Contextual AI",
  "Evolutionary journey",
];

const moats = [
  {
    icon: Gauge,
    title: "A score that builds itself",
    desc: "No courses, no forms, no friction. The financial history grows out of savings behavior and marketplace activity — not a sign-up form an entrepreneur has to stop and fill in.",
  },
  {
    icon: ShieldCheck,
    title: "Continuous impact proof, not an annual report",
    desc: "Instead of self-reported ESG once a year, every allocation and every outcome is recorded on-chain. Impact is verifiable in real time — not a promise in a PDF.",
  },
];

const DifferentialSectionEn = () => (
  <section id="difference" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Why it's different</p>
        <h2 className="section-title">
          The only player at the{" "}
          <span className="text-gradient">intersection of these five layers</span>
        </h2>
        <p className="section-subtitle">
          Each piece exists alone in the market. The moat is bringing them all together — and making each one reinforce the next.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {intersection.map((item, i) => (
          <div key={item} className="flex items-center gap-3">
            <span className="glass rounded-full px-5 py-2.5 glow-border font-heading font-semibold text-foreground text-sm">
              {item}
            </span>
            {i < intersection.length - 1 && (
              <Network className="text-accent hidden sm:block" size={16} />
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {moats.map(({ icon: Icon, title, desc }) => (
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

export default DifferentialSectionEn;
