import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const cycle = [
  { label: "USDC", sub: "Stablecoin liquidity", emphasis: true },
  { label: "Productive credit", emphasis: true },
  { label: "Inventory · Equipment · Working capital" },
  { label: "Business revenue" },
  { label: "Repayment" },
  { label: "USDC", sub: "Back to the pool", emphasis: true },
];

// The forward-looking metric set the pilot is instrumented to produce. Values
// stay deliberately absent until there is a real pilot behind them.
const metrics = [
  "Productive Capital Deployed",
  "Productive Stablecoin Volume",
  "Businesses Funded",
  "Repayment Rate",
  "Capital Repaid",
  "Economic Outcomes",
];

const ProductiveCapitalSectionEn = () => (
  <section id="productive-capital" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Productive stablecoin capital"
        title="From stablecoin liquidity to"
        accent="productive capital."
        subtitle="Stablecoins shouldn't only move between wallets and protocols. They can finance businesses in the real economy."
      />

      <CapitalFlow
        steps={cycle}
        loopLabel="Capital repaid can be redeployed — the cycle repeats."
        caption="Stablecoin liquidity becomes productive credit, is spent on inventory, equipment or working capital, generates business revenue, is repaid, and returns to the pool as stablecoins."
      />

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow md:p-14">
        <p className="font-heading text-2xl font-bold leading-tight text-foreground md:text-3xl">
          What if stablecoin liquidity could{" "}
          <span className="text-gradient">finance the real economy?</span>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          EmpowerFI is building the infrastructure to transform global stablecoin liquidity
          into productive credit for small businesses.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card/50 p-8 md:p-10">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Productive Stablecoin Volume — PSV
          </p>
          <p className="max-w-3xl leading-relaxed text-foreground">
            The volume of stablecoin activity deployed into productive real-world economic
            activity through EmpowerFI.
          </p>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            PSV is the metric we are building the infrastructure to report. These are the
            figures the first pilot is instrumented to produce — none of them carry a value
            until there is a real pilot behind them.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <li
              key={metric}
              className="rounded-xl border border-border bg-background/60 px-5 py-4"
            >
              <p className="font-heading text-sm font-semibold text-foreground">{metric}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />
                Pilot launching soon
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

export default ProductiveCapitalSectionEn;
