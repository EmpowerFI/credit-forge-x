import { ArrowRight, Database, Gauge, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import CapitalFlow from "@/components/CapitalFlow";

const pillars = [
  {
    icon: Layers,
    title: "Asset-light by design",
    desc: "EmpowerFI is the technology and servicing layer. The funding, the credit policy and the final lending decision sit with a licensed financial partner. Revenue comes from programmes, origination and servicing — not from carrying loans on our own balance sheet.",
  },
  {
    icon: Database,
    title: "The moat is longitudinal data",
    desc: "Readiness, credit decision, repayment and productive outcome, connected for the same business over time. It cannot be bought or back-filled; it only accumulates by being present before the credit request and staying after it.",
  },
  {
    icon: Gauge,
    title: "Cost to serve is the number that matters",
    desc: "Measured from the first day of the journey, not from disbursement — acquisition, education, readiness, origination, servicing, collection and outcome. Small tickets fail on operating cost, so that is the cost we instrument.",
  },
];

const flow = [
  { label: "Community", sub: "Programme or cohort", emphasis: true },
  { label: "Readiness" },
  { label: "Qualified opportunity", emphasis: true },
  { label: "Partner decision" },
  { label: "Servicing" },
  { label: "Productive outcome", emphasis: true },
];

const InvestorThesis = () => (
  <section id="thesis" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">The thesis</p>
        <h2 className="section-title">
          Small businesses don't only need more capital. The market needs a cheaper way to{" "}
          <span className="text-gradient">prepare, assess, finance and follow them.</span>
        </h2>
        <p className="section-subtitle">
          EmpowerFI turns entrepreneur programmes into measurable credit-readiness pipelines,
          then originates qualified opportunities for financial partners and services the
          operations that follow.
        </p>
      </div>

      <CapitalFlow
        steps={flow}
        caption="A community or programme becomes a readiness pipeline, a qualified credit opportunity reaches a financial partner, and the operation is serviced and measured after disbursement."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card/50 p-8 md:p-10">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Where capital fits, and when
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Today EmpowerFI is a technology layer: capital and the final decision come from a
          licensed partner. A capital platform — connecting investors directly to businesses
          qualified by the same infrastructure — is the intended evolution, and it depends on
          a regulatory structure we have not yet built and do not claim to hold.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We are not a peer-to-peer lender, and nothing here is an offer. The sequence is
          deliberate: validate distribution, readiness, origination, repayment and unit
          economics first; add the capital layer only once those hold.
        </p>
      </div>

      <p className="text-center">
        <Link
          to="/#problem"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-foreground"
        >
          See the full picture on the home page <ArrowRight size={14} />
        </Link>
      </p>
    </div>
  </section>
);

export default InvestorThesis;
