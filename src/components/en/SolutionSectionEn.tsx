import { Activity, BarChart3, GraduationCap, Radar, ShieldCheck, Users } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

// The four verbs are the approved product message, in order. They are also the
// order of the funnel, which is why they read as a spine rather than a list.
const verbs = [
  { verb: "Prepare", desc: "before credit" },
  { verb: "Originate", desc: "better" },
  { verb: "Service", desc: "continuously" },
  { verb: "Measure", desc: "outcomes" },
];

const capabilities = [
  {
    icon: Users,
    title: "Verified communities",
    desc: "Capital starts in a community or programme with a named operational owner, not in an anonymous application form.",
  },
  {
    icon: GraduationCap,
    title: "Education journey",
    desc: "A minimum track on business management and finance. Completion is a signal, never a guarantee.",
  },
  {
    icon: BarChart3,
    title: "Business organization",
    desc: "Recurring check-ins on sales, costs, cash, withdrawals, inventory and obstacles — two to four minutes at a time.",
  },
  {
    icon: ShieldCheck,
    title: "Readiness measurement",
    desc: "A deterministic, versioned assessment of whether the business is prepared, and what is still missing if it is not.",
  },
  {
    icon: Radar,
    title: "Digital servicing",
    desc: "Monitoring after disbursement, not only before it: payments, use of capital, exceptions and interventions.",
  },
  {
    icon: Activity,
    title: "Outcome measurement",
    desc: "Evidence of what the capital produced — repayment, productive use and business change — not just where it went.",
  },
];

const SolutionSectionEn = () => (
  <section id="solution" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="The solution"
        title="Prepare before credit."
        accent="Then originate, service and measure."
        subtitle="One system that turns entrepreneur programmes into measurable credit-readiness pipelines — and stays with the operation after the money moves."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {verbs.map(({ verb, desc }, i) => (
          <div key={verb} className="rounded-xl p-6 glass glow-border">
            <span className="font-mono text-xs text-accent">0{i + 1}</span>
            <p className="mt-2 font-heading text-xl font-bold text-foreground">{verb}</p>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={20} />
            </div>
            <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Every operation strengthens{" "}
          <span className="text-gradient">the same dataset.</span>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Readiness, credit decision, repayment and productive outcome, connected for the same
          business over time. That longitudinal record is the part competitors cannot buy —
          it only accumulates by being there before the credit request and staying after it.
        </p>
      </div>
    </div>
  </section>
);

export default SolutionSectionEn;
