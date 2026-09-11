import { ClipboardCheck, Compass, PhoneCall, Repeat } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

// The four cost stages that barely shrink with ticket size. This is the whole
// problem statement: fixed costs land disproportionately on small loans.
const stages = [
  {
    icon: ClipboardCheck,
    title: "Origination",
    desc: "Registration, KYC, data collection and economic assessment.",
  },
  {
    icon: Compass,
    title: "Orientation",
    desc: "Business planning and defining what the capital is actually for.",
  },
  {
    icon: Repeat,
    title: "Servicing",
    desc: "Monitoring through the life of the contract and handling exceptions.",
  },
  {
    icon: PhoneCall,
    title: "Collection",
    desc: "Contact, renegotiation and recovery when they become necessary.",
  },
];

const ProblemSectionEn = () => (
  <section id="problem" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="The problem"
        title="Small productive credit has a"
        accent="structural unit-economics problem."
        subtitle="The work of originating, guiding and servicing a loan barely changes with its size. On a small ticket, those fixed costs land disproportionately — which is what makes the economics fail, not the borrower."
      />

      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="font-heading text-4xl font-bold text-gradient md:text-5xl">
          US$14 / US$100
        </p>
        <p className="leading-relaxed text-foreground">
          Median operating expense per US$100 of portfolio across the microfinance
          institutions analysed. Institutions making smaller loans face particularly high
          unit costs.
        </p>
        <p className="text-sm text-muted-foreground">
          World Bank, WPS8252 — 3,845 institution-years covering 291 million borrower-years,
          2005&ndash;2009.
        </p>
      </div>

      <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
        That benchmark is historical and international. It does not represent EmpowerFI's
        cost to serve, or Brazil's. It is evidence that fixed costs weigh proportionally more
        on small tickets — not a claim about our own economics, which the pilot is being
        built to measure.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={20} />
            </div>
            <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <p className="mx-auto max-w-3xl text-center font-heading text-lg font-semibold leading-relaxed text-foreground">
        The pilot does not need to prove the problem exists. It needs to measure how much
        EmpowerFI compresses the cost to serve{" "}
        <span className="text-gradient">without degrading credit quality.</span>
      </p>
    </div>
  </section>
);

export default ProblemSectionEn;
