import { Coins, Receipt, Unplug } from "lucide-react";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const frictions = [
  {
    icon: Receipt,
    title: "Small tickets carry big fixed costs",
    desc: "Traditional credit infrastructure was not designed for loans of $50, $100 or $200. Originating, monitoring and servicing a small ticket costs almost the same as a large one — which is what makes the economics fail, not the borrower.",
  },
  {
    icon: Coins,
    title: "The capital exists. The route does not.",
    desc: "Global capital looking for financial return and measurable impact stays disconnected from these businesses. There is no efficient path from a pool of liquidity to a business that needs $200 to buy inventory next week.",
  },
  {
    icon: Unplug,
    title: "So the business stays at survival scale",
    desc: "Millions of microentrepreneurs in emerging markets need small amounts of capital for inventory, equipment or working capital. Without it, a business that works never gets the fuel to grow.",
  },
];

const flow = [
  { label: "Global capital", sub: "Looking for return and impact", emphasis: true },
  { label: "Financial friction", sub: "Cost, distance, infrastructure" },
  { label: "Small businesses", sub: "Need $50–$200 to grow", emphasis: true },
];

const ProblemSectionEn = () => (
  <section id="problem" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="The problem"
        title="Small businesses don't lack potential."
        accent="They lack access to capital."
        subtitle="The gap is not a shortage of money. It is the missing infrastructure between capital and the businesses that can put it to work."
      />

      <CapitalFlow
        steps={flow}
        caption="Global capital is separated from small businesses by financial friction."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {frictions.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-2xl p-8 text-left glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ProblemSectionEn;
