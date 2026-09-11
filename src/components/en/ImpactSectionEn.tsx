import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const outcomes = [
  "Repayment performance and portfolio at risk",
  "Share of capital applied to its declared purpose",
  "Revenue, margin and cash-flow proxy, before and after",
  "Inventory or capacity change where measurable",
  "Economic Value Created — incremental profit less the total cost of the credit",
  "Economic Value Multiple — value created per unit of capital deployed",
];

const chain = [
  { label: "Capital", emphasis: true },
  { label: "Business" },
  { label: "Outcome" },
  { label: "Evidence", emphasis: true },
];

const ImpactSectionEn = () => (
  <section id="impact" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Impact"
        title="Good credit is not only credit"
        accent="that gets repaid."
        subtitle="Repayment tells you the operation worked for the lender. It tells you nothing about whether the business is better off. We intend to measure both."
      />

      <CapitalFlow
        steps={chain}
        caption="Capital reaches a business, the business produces an outcome, and the outcome becomes evidence."
      />

      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-accent">
          What we intend to report
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map((outcome) => (
            <li key={outcome} className="glass rounded-xl px-5 py-4 glow-border">
              <p className="font-heading text-sm font-semibold text-foreground">{outcome}</p>
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-muted-foreground">
          These metrics have no values yet. They will be reported once the first pilot
          produces them.
        </p>
      </div>

      {/* The pilot is an observational design, not a controlled one. Saying so
          here is cheaper than being asked, and it is the difference between
          evidence and a claim. */}
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card/50 p-8 md:p-10">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          What we will not claim
        </p>
        <p className="leading-relaxed text-muted-foreground">
          A business that grows after receiving capital has not proven that the capital caused
          the growth. The pilot is observational, so changes will be reported as observed
          association and contribution — not as causal impact — unless and until a design that
          supports a causal claim exists.
        </p>
      </div>
    </div>
  </section>
);

export default ImpactSectionEn;
