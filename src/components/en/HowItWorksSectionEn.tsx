import { ShoppingBag, Gauge, Landmark, Bot } from "lucide-react";

const layers = [
  {
    icon: ShoppingBag,
    tag: "Live now",
    tagLive: true,
    title: "Marketplace",
    desc: "Connects women micro-entrepreneurs to new clients and to each other. It generates real economic activity — sales, payments, reputation — and the data that powers everything that follows.",
  },
  {
    icon: Gauge,
    tag: "Next",
    title: "Invisible alternative score",
    desc: "Built from what she already does: the payments she receives, her marketplace activity, her financial discipline over time. No courses, no forms, no friction — the track record builds itself as she does business.",
  },
  {
    icon: Landmark,
    tag: "Then",
    title: "RWA capital pool",
    desc: "Tokenization is what brings global impact capital to entrepreneurs the banking system does not reach — with Treasury collateral protecting the principal. Every amount and every impact is recorded on blockchain: continuous, auditable proof, not an annual report.",
  },
  {
    icon: Bot,
    tag: "Then",
    title: "AI copilot",
    desc: "Contextual guidance in the day-to-day of the business: organizing finances, prioritizing decisions, understanding the next step. The AI suggests — a human always decides.",
  },
];

const HowItWorksSectionEn = () => (
  <section id="how-it-works" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">How it works</p>
        <h2 className="section-title">
          Four layers that build{" "}
          <span className="text-gradient">on top of each other</span>
        </h2>
        <p className="section-subtitle">
          The marketplace ships first and generates the data. The other layers follow in sequence, on that foundation.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {layers.map(({ icon: Icon, tag, tagLive, title, desc }, i) => (
          <div key={title} className="relative glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
            <span className="text-xs font-mono text-accent">0{i + 1}</span>
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center my-4">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium mb-3 ${tagLive ? "glow-border text-accent" : "bg-muted text-muted-foreground"}`}>
              {tagLive && <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />}
              {tag}
            </span>
            <h3 className="font-heading font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSectionEn;
