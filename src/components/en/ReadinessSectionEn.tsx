import { Calculator, ClipboardList, Landmark } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

// Three judgements, three owners. Collapsing any two of them is the mistake the
// whole model exists to avoid, so the site states them as separate columns.
const judgements = [
  {
    icon: ClipboardList,
    owner: "EmpowerFI",
    title: "Readiness",
    question: "Is the business prepared?",
    desc: "Verified community membership, education progress, how regularly the business reports, how complete and consistent the data is, and how long a history exists. Produces a status, what is still missing, and reason codes.",
  },
  {
    icon: Calculator,
    owner: "EmpowerFI",
    title: "Eligibility",
    question: "For this amount, on this business?",
    desc: "Affordability against a cash-flow proxy, a suggested ticket range, a risk band, a confidence level and reason codes — evaluated for a specific requested amount, and only once the entrepreneur has asked.",
  },
  {
    icon: Landmark,
    owner: "The financial partner",
    title: "Approval",
    question: "Do we lend?",
    desc: "The partner keeps its own credit policy, its own underwriting and its own capital. EmpowerFI does not make the lending decision, and the two records are stored separately.",
  },
];

const signals = [
  { title: "Business activity", desc: "What the business sells, and how steadily." },
  { title: "Financial organization", desc: "Whether money in and money out are tracked at all." },
  { title: "Reporting regularity", desc: "How consistently the business reports over time." },
  { title: "Data quality", desc: "Completeness and internal consistency of what is reported." },
  { title: "Business evolution", desc: "Whether the business is growing, holding or shrinking." },
  { title: "Productive purpose", desc: "What the capital would be for, declared before it is assessed." },
];

const ReadinessSectionEn = () => (
  <section id="readiness" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Readiness"
        title="Readiness is not eligibility."
        accent="Eligibility is not approval."
        subtitle="Three different questions, asked at three different moments, answered by two different parties. Keeping them apart is what makes each one honest."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {judgements.map(({ icon: Icon, owner, title, question, desc }) => (
          <div key={title} className="flex flex-col rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent">
              {owner}
            </p>
            <h3 className="mt-1.5 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="mb-3 font-heading text-sm italic text-muted-foreground">
              {question}
            </p>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          What readiness observes
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map(({ title, desc }) => (
            <div key={title} className="glass rounded-xl p-6 glow-border">
              <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Signals from the business.{" "}
          <span className="text-gradient">Never from the app.</span>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          How often someone opens a notification, how long they spend on a screen, how quickly
          they reply — none of it reaches readiness or eligibility. Available time is not
          creditworthiness, and treating it as a signal would penalise exactly the
          entrepreneurs this exists to serve.
        </p>
      </div>

      <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
        The readiness and eligibility engines are deterministic and versioned: the same inputs
        produce the same result, every decision carries the model version that produced it, and
        every result can be recomputed and audited. No claim is made about default rates until
        there is a pilot behind it.
      </p>
    </div>
  </section>
);

export default ReadinessSectionEn;
