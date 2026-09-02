import { Activity, BarChart3, Brain, Coins, Radar, Wrench } from "lucide-react";
import CapitalFlow from "./CapitalFlow";
import SectionHeading from "./SectionHeading";

const components = [
  { icon: BarChart3, title: "Business data", desc: "What the business actually does, day to day." },
  { icon: Brain, title: "Alternative credit intelligence", desc: "Underwriting signals for businesses with little formal history." },
  { icon: Radar, title: "Continuous monitoring", desc: "Credit that is followed after disbursement, not only before it." },
  { icon: Wrench, title: "Digital servicing", desc: "Origination, disbursement and collection handled digitally, at small-ticket cost." },
  { icon: Coins, title: "Stablecoin infrastructure", desc: "A settlement rail that makes cross-border small tickets viable." },
  { icon: Activity, title: "Measurable economic outcomes", desc: "Evidence of what the capital produced, not just where it went." },
];

const flow = [
  { label: "Global capital", emphasis: true },
  { label: "Stablecoins" },
  { label: "Solana" },
  { label: "EmpowerFI", sub: "Credit infrastructure", emphasis: true },
  { label: "Local currency" },
  { label: "Microbusiness", emphasis: true },
  { label: "Business growth", sub: "+ repayment data" },
  { label: "Better credit intelligence" },
];

const SolutionSectionEn = () => (
  <section id="solution" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="The solution"
        title="A new infrastructure for"
        accent="productive credit."
        subtitle="One system that moves capital to the business, follows what happens next, and turns that back into better credit decisions."
      />

      <CapitalFlow
        steps={flow}
        caption="Global capital converts to stablecoins, settles on Solana, passes through EmpowerFI's credit infrastructure, reaches a microbusiness in local currency, and returns as growth and repayment data that improves credit intelligence."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {components.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={20} />
            </div>
            <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SolutionSectionEn;
