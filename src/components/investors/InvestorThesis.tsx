import { ArrowRight, Brain, Globe2, Target } from "lucide-react";
import { Link } from "react-router-dom";
import CapitalFlow from "@/components/CapitalFlow";

const pillars = [
  {
    icon: Globe2,
    title: "A rail that makes small tickets viable",
    desc: "A $50–$200 loan cannot carry the cost of traditional cross-border infrastructure. Stablecoin settlement on Solana is what moves those economics from impossible to workable.",
  },
  {
    icon: Brain,
    title: "Intelligence built from the business itself",
    desc: "Underwriting signals come from business activity, management behavior and repayment history — a richer view of capacity than a thin bank file can offer.",
  },
  {
    icon: Target,
    title: "Outcomes, not just disbursements",
    desc: "We track what the capital produced: businesses funded, repayment performance, revenue evolution, businesses still active. Evidence, rather than a self-reported annual claim.",
  },
];

const flow = [
  { label: "Global capital", sub: "USDC", emphasis: true },
  { label: "EmpowerFI", sub: "Credit infrastructure", emphasis: true },
  { label: "Microbusiness", sub: "Local currency", emphasis: true },
  { label: "Repayment + evidence" },
];

const InvestorThesis = () => (
  <section id="thesis" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">The thesis</p>
        <h2 className="section-title">
          Turn global liquidity into <span className="text-gradient">productive capital.</span>
        </h2>
        <p className="section-subtitle">
          Stablecoins shouldn't only move between wallets and protocols. They can finance
          businesses in the real economy — if the infrastructure in between actually exists.
        </p>
      </div>

      <CapitalFlow
        steps={flow}
        caption="Global capital in USDC passes through EmpowerFI to a microbusiness in local currency, and returns as repayment and evidence."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <p className="text-center">
        <Link
          to="/#problem"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-foreground"
        >
          See the full picture on the home page <ArrowRight size={14} />
        </Link>
      </p>
    </div>
  </section>
);

export default InvestorThesis;
