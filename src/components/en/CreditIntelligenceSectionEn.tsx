import SectionHeading from "./SectionHeading";

const signals = [
  { title: "Business activity", desc: "What the business sells, and how steadily." },
  { title: "Management behavior", desc: "How the business is run day to day." },
  { title: "Financial organization", desc: "Whether money in and money out are tracked at all." },
  { title: "Credit repayment", desc: "How prior productive credit was repaid." },
  { title: "Business evolution", desc: "Whether the business is growing, holding or shrinking." },
  { title: "Engagement with support", desc: "Use of the tools and guidance available to the entrepreneur." },
];

const CreditIntelligenceSectionEn = () => (
  <section id="credit-intelligence" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Credit intelligence"
        title="Credit should understand the business —"
        accent="not just the bank account."
        subtitle="EmpowerFI follows signals tied to the activity and management of the business itself."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {signals.map(({ title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border">
            <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Observe behavior. <span className="text-gradient">Don't infer it.</span>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Together, these signals can build a richer view of repayment capacity for small
          businesses that carry little history in the traditional financial system — where a
          conventional model has nothing to look at and simply says no.
        </p>
      </div>
    </div>
  </section>
);

export default CreditIntelligenceSectionEn;
