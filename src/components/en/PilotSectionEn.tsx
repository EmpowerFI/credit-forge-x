import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/SectionHeading";

// The 12-month pilot roadmap, written as intent rather than promise. Every
// figure is planned scope, nothing past a gate happens unless the gate is met,
// and the capital and the credit decision come from financial partners — the
// copy must never read as EmpowerFI lending directly, or as a claim that the
// pilot will prove a default rate.

const journey = [
  "Community",
  "Preparation",
  "Data",
  "Credit Readiness",
  "Eligibility",
  "Credit",
  "Servicing",
  "Outcome",
];

interface Phase {
  kind: "phase";
  step: number;
  stage: string;
  period: string;
  /** First and last month the phase covers, 1-based, for the progress bar. */
  months: [number, number];
  title: string;
  desc: string;
  goals: string[];
  /** Supporting line under the goals, where the brief gives one. */
  note?: string;
  /** Label of the gate that follows this phase, drawn on the desktop rail. */
  gateAfter?: string;
  /** Grid placement on the horizontal (xl) layout. */
  place: string;
}

interface Gate {
  kind: "gate";
  label: string;
  title: string;
  text: string;
  place: string;
}

// Listed in reading order: on the vertical layout the gates sit between the
// phases they separate; on the horizontal one they move to a row of their own
// under the phases, while the rail marks where each one falls.
const roadmap: (Phase | Gate)[] = [
  {
    kind: "phase",
    step: 1,
    stage: "Preparation",
    period: "Months 0–3",
    months: [1, 3],
    title: "Build the pipeline",
    desc: "Form the first cohort, structure the preparation journey and start building recurring data on each business.",
    goals: [
      "A partnership with a community or entrepreneurship programme",
      "Onboarding of the first participants",
      "Financial education and organization",
      "Recurring business check-ins",
      "A first Credit Readiness assessment",
    ],
    note: "Before credit, we need to understand the business.",
    place: "xl:col-start-1 xl:row-start-1",
  },
  {
    kind: "phase",
    step: 2,
    stage: "First operations",
    period: "Months 4–5",
    months: [4, 5],
    title: "Origination and credit",
    desc: "Identify prepared entrepreneurs, structure qualified opportunities and carry out the first operations through a financial partner.",
    goals: [
      "Identify participants with a real need for capital",
      "Assess eligibility and repayment capacity",
      "Generate qualified opportunities",
      "Around 5–10 first operations, with capital provided by financial partners",
      "Start follow-up after credit",
    ],
    note: "The financial partner makes the credit decision and provides the capital.",
    gateAfter: "Gate 1",
    place: "xl:col-start-2 xl:row-start-1",
  },
  {
    kind: "gate",
    label: "Gate 1 · after month 5",
    title: "Validate before scaling",
    text: "Before expanding the pilot, we will review conversion, data quality, operating cost, the entrepreneur's experience and the safety of the operation.",
    place: "xl:col-span-2 xl:col-start-1 xl:row-start-2",
  },
  {
    kind: "phase",
    step: 3,
    stage: "Controlled scale",
    period: "Months 6–9",
    months: [6, 9],
    title: "Scale what works",
    desc: "Expand the operation gradually and turn the early lessons into more efficient origination infrastructure.",
    goals: [
      "New cohorts",
      "Around 20–35 cumulative operations",
      "Evolution of the Credit Readiness Engine",
      "Less rework and manual effort",
      "A first origination package for partners",
      "Follow-up on repayment and productive use of capital",
    ],
    note: "Scale the process, not just the volume.",
    gateAfter: "Gate 2",
    place: "xl:col-start-3 xl:row-start-1",
  },
  {
    kind: "gate",
    label: "Gate 2 · after month 9",
    title: "Validate the economics",
    text: "Review portfolio performance, Cost to Serve, conversion, decision time and the value generated for partners before the next stage.",
    place: "xl:col-span-2 xl:col-start-3 xl:row-start-2",
  },
  {
    kind: "phase",
    step: 4,
    stage: "Proof of model",
    period: "Months 10–12",
    months: [10, 12],
    title: "Turn the pilot into infrastructure",
    desc: "Consolidate an auditable productive-credit case and prepare commercial and technology expansion.",
    goals: [
      "Around 30–50 cumulative operations",
      "A performance and lessons-learned report",
      "A Cost to Serve case",
      "A track record across readiness, credit, repayment and outcome",
      "A commercial proposal for new partners",
      "Design of the next capital layer",
      "P2P and stablecoins: assessed as a future step, not offered today",
    ],
    place: "xl:col-start-4 xl:row-start-1",
  },
];

const scope = [
  { value: "50–100", label: "participants" },
  {
    value: "20–30",
    label: "with enough data for a Credit Readiness assessment",
  },
  { value: "5–10", label: "first operations, with financial partners" },
  {
    value: "30–50",
    label: "cumulative operations in 12 months, if the gates are met",
  },
];

const questions = [
  "Can we identify better-prepared entrepreneurs before they ask for credit?",
  "Can we reduce the operational effort needed to serve small tickets?",
  "Do financial institutions value better-qualified credit opportunities?",
  "What is the Cost to Serve at each stage of the journey?",
  "Was the capital used productively, and what results can we observe?",
  "Does the data we generate justify moving to a capital platform of our own?",
];

/** Twelve cells, one per month: earlier months muted, this phase in gold. */
const MonthBar = ({ months: [first, last] }: { months: [number, number] }) => (
  <div aria-hidden className="flex gap-0.5">
    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
      <span
        key={m}
        className={`h-1.5 flex-1 rounded-full ${
          m < first ? "bg-accent/30" : m <= last ? "bg-accent" : "bg-border"
        }`}
      />
    ))}
  </div>
);

// The rail: vertical down the left below xl, horizontal across the top at xl.
// Items carry their own segment, and padding rather than grid gaps keeps the
// segments touching.
const railClass =
  "absolute left-4 top-0 w-px bg-accent/30 xl:bottom-auto xl:left-0 xl:right-0 xl:top-4 xl:h-px xl:w-auto";

const PhaseItem = ({ phase, isLast }: { phase: Phase; isLast: boolean }) => (
  <li
    className={`relative pb-12 pl-12 xl:pb-0 xl:pl-0 xl:pr-10 xl:pt-14 ${phase.place}`}
  >
    <span
      aria-hidden
      className={`${railClass} ${isLast ? "h-4" : "bottom-0"}`}
    />
    <span
      aria-hidden
      className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-accent/60 bg-background font-heading text-sm font-bold text-accent"
    >
      {phase.step}
    </span>
    {phase.gateAfter && (
      <span
        aria-hidden
        className="absolute right-3 top-0 hidden flex-col items-center xl:flex"
      >
        <span className="mt-[11px] h-2.5 w-2.5 rotate-45 bg-accent" />
        <span className="mt-2 text-[10px] font-medium uppercase tracking-widest text-accent">
          {phase.gateAfter}
        </span>
      </span>
    )}

    <p className="text-xs font-medium uppercase tracking-widest text-accent">
      Phase {phase.step} · {phase.stage}
    </p>
    <h3 className="mt-2 font-heading text-xl font-bold text-foreground xl:min-h-[3.5rem]">
      {phase.title}
    </h3>
    <div className="mt-3 flex items-center gap-3">
      <div className="flex-1">
        <MonthBar months={phase.months} />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {phase.period}
      </span>
    </div>
    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
      {phase.desc}
    </p>
    <ul className="mt-4 space-y-2">
      {phase.goals.map((goal) => (
        <li
          key={goal}
          className="flex gap-2 text-sm leading-relaxed text-foreground"
        >
          <Check aria-hidden size={14} className="mt-1 shrink-0 text-accent" />
          {goal}
        </li>
      ))}
    </ul>
    {phase.note && (
      <p className="mt-5 border-l-2 border-accent pl-3 text-sm font-medium text-foreground">
        {phase.note}
      </p>
    )}
  </li>
);

const GateItem = ({ gate }: { gate: Gate }) => (
  <li
    className={`relative pb-12 pl-12 xl:mt-12 xl:pb-0 xl:pl-0 xl:pr-10 ${gate.place}`}
  >
    <span aria-hidden className={`${railClass} bottom-0 xl:hidden`} />
    <span
      aria-hidden
      className="absolute left-[11px] top-6 h-2.5 w-2.5 rotate-45 bg-accent xl:hidden"
    />
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 xl:p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">
        {gate.label}
      </p>
      <h3 className="mt-2 font-heading text-lg font-bold text-foreground">
        {gate.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {gate.text}
      </p>
    </div>
  </li>
);

const PilotSectionEn = () => (
  <section id="pilot" className="section-padding">
    <div className="container mx-auto space-y-16">
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Pilot · next 12 months"
          title="Pilot"
          accent="roadmap."
          subtitle="From preparing for credit to validating productive-credit infrastructure."
        />
        <div className="mx-auto max-w-3xl space-y-4 text-center leading-relaxed text-muted-foreground">
          <p>
            Over the next 12 months, EmpowerFI intends to validate a complete
            journey: preparing entrepreneurs, building a business track record,
            identifying who is ready to receive capital, originating the first
            operations with financial partners and following the results after
            credit.
          </p>
          <p>
            The pilot will run in stages, and each decision to advance will be
            based on data.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-center text-sm font-medium text-foreground">
            The pilot does not start with the loan.
          </p>
          <ol
            aria-label="The pilot journey"
            className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground"
          >
            {journey.map((stage, i) => (
              <li key={stage} className="flex items-center gap-2">
                {i > 0 && (
                  <ChevronRight aria-hidden size={14} className="text-accent" />
                )}
                <span
                  className={
                    stage === "Credit Readiness" ? "text-accent" : undefined
                  }
                >
                  {stage}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ol
        aria-label="Pilot phases and checkpoints"
        className="mx-auto max-w-3xl xl:grid xl:max-w-none xl:grid-cols-4"
      >
        {roadmap.map((item, i) =>
          item.kind === "phase" ? (
            <PhaseItem
              key={item.title}
              phase={item}
              isLast={i === roadmap.length - 1}
            />
          ) : (
            <GateItem key={item.title} gate={item} />
          ),
        )}
      </ol>

      <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-background/60 p-8 md:p-10">
        <h3 className="text-sm font-medium uppercase tracking-widest text-accent">
          Planned initial scope
        </h3>
        <ul className="mt-6 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {scope.map(({ value, label }) => (
            <li key={value} className="space-y-1">
              <p className="whitespace-nowrap font-heading text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">
                {value}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {label}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
          Indicative planning targets, not results. Each figure depends on the
          phase before it — and on the gates being met.
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-8">
        <h3 className="text-center font-heading text-2xl font-bold text-foreground md:text-3xl">
          What the pilot needs to answer
        </h3>
        <ol className="grid gap-x-10 md:grid-cols-2">
          {questions.map((q, i) => (
            <li key={q} className="flex gap-4 border-t border-border py-5">
              <span
                aria-hidden
                className="font-heading text-sm font-bold text-accent"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="leading-relaxed text-foreground">{q}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="text-xs font-medium uppercase tracking-widest text-accent">
          Prepare before credit · Originate better · Service continuously ·
          Measure outcomes
        </p>
        <h3 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Want to take part in the pilot?
        </h3>
        <p className="leading-relaxed text-muted-foreground">
          We are looking for communities, impact programmes and financial
          partners interested in building a more efficient way to prepare and
          finance small businesses.
        </p>
        <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <a href="#for-partners">
              Talk to EmpowerFI <ArrowRight size={18} />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary/40 text-foreground hover:bg-primary/10"
          >
            <Link to="/about">Get to know EmpowerFI</Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default PilotSectionEn;
