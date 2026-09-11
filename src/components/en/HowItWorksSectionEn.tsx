import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const conventional = [
  { label: "Credit request", emphasis: true },
  { label: "Analysis" },
  { label: "Orientation" },
  { label: "Disbursement" },
  { label: "Monitoring" },
];

const empowerfi = [
  { label: "Community", emphasis: true },
  { label: "Education" },
  { label: "Organization" },
  { label: "Business data" },
  { label: "Readiness", emphasis: true },
  { label: "Credit intent", emphasis: true },
  { label: "Eligibility" },
  { label: "Credit" },
  { label: "Servicing" },
];

// The six answers the system is allowed to give. Most lending products can only
// say yes or no; being able to say "not yet", "not needed" or "look at this by
// hand" is the point of preparing before the request.
const outcomes = [
  { title: "Ready for credit", desc: "Prepared, with enough data behind the judgement." },
  { title: "Needs more data", desc: "The business is running; the record of it is too thin." },
  { title: "Needs more preparation", desc: "Organization or education still in progress." },
  { title: "No current need for capital", desc: "Ready, and not looking to borrow. A good outcome." },
  { title: "Manual review", desc: "The rules are not confident enough to decide alone." },
  { title: "Not eligible right now", desc: "With the reason codes that say what would change it." },
];

const HowItWorksSectionEn = () => (
  <section id="how-it-works" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="How it works"
        title="The funnel starts before"
        accent="the credit request."
        subtitle="Preparation, organization and business data come first. By the time capital is discussed, there is already a record to discuss it with."
      />

      <div className="space-y-10">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Conventional flow
          </p>
          <CapitalFlow steps={conventional} />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            EmpowerFI
          </p>
          <CapitalFlow
            steps={empowerfi}
            caption="The journey does two jobs at once: for the entrepreneur it prepares the business to access capital; for the credit provider it produces a qualified origination pipeline before the final analysis."
          />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Credit is not the goal{" "}
          <span className="text-gradient">for every entrepreneur.</span>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          A good funnel also identifies who should wait, who should organize the business
          further, and who should not take on debt at all. Completing the education journey
          never makes anyone automatically eligible.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {outcomes.map(({ title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border">
            <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSectionEn;
