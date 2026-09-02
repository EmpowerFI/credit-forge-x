import CapitalFlow from "./CapitalFlow";
import SectionHeading from "./SectionHeading";

const outcomes = [
  "Businesses funded",
  "Productive capital deployed",
  "Repayment performance",
  "Business revenue evolution",
  "Businesses still active",
  "Jobs maintained or created",
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
        title="Financial return meets"
        accent="measurable economic impact."
        subtitle="EmpowerFI does not only measure how much capital was sent. What matters is what happened afterwards."
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
    </div>
  </section>
);

export default ImpactSectionEn;
