import { Building2, Layers, Store } from "lucide-react";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const participants = [
  {
    icon: Building2,
    role: "Investors",
    desc: "Global investors discover productive credit opportunities and deploy capital using stablecoins.",
  },
  {
    icon: Layers,
    role: "EmpowerFI",
    desc: "EmpowerFI provides credit intelligence, underwriting signals, monitoring, servicing and impact measurement.",
  },
  {
    icon: Store,
    role: "Entrepreneurs",
    desc: "Entrepreneurs receive local currency, invest in their businesses and repay locally.",
  },
];

const flow = [
  { label: "Investor", sub: "USDC", emphasis: true },
  { label: "Solana" },
  { label: "EmpowerFI", emphasis: true },
  { label: "Local financial rail" },
  { label: "Entrepreneur", sub: "Pix / local currency", emphasis: true },
];

const HowItWorksSectionEn = () => (
  <section id="how-it-works" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="How it works"
        title="Three participants,"
        accent="one chain of capital."
        subtitle="Capital starts as stablecoins and arrives as local currency in a business bank account. Everything between the two is infrastructure."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {participants.map(({ icon: Icon, role, desc }, i) => (
          <div key={role} className="glass rounded-2xl p-8 glow-border">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
                <Icon className="text-primary-foreground" size={22} />
              </div>
              <span className="font-mono text-xs text-accent">0{i + 1}</span>
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{role}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <CapitalFlow
        steps={flow}
        caption="An investor's USDC settles on Solana, passes through EmpowerFI, converts on a local financial rail and reaches the entrepreneur as local currency over Pix."
      />

      <p className="text-center text-sm text-muted-foreground">
        The entrepreneur does not need to hold a wallet or know that a blockchain was
        involved.
      </p>
    </div>
  </section>
);

export default HowItWorksSectionEn;
