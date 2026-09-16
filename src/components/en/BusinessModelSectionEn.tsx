import { Coins, Network, Users } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

// The three layers are cumulative, not sequential replacements — that is the
// whole point of the table, so each card carries its own customer, revenue and
// capital-risk line rather than a generic description.
const layers = [
  {
    icon: Users,
    phase: "Layer 1",
    status: "In build",
    title: "Readiness & Community Intelligence",
    customer: "NGOs, communities, ESG and corporate social-impact programmes",
    revenue: "Community Intelligence: a B2B contract per programme or cohort, licence and reporting",
    risk: "No capital risk",
    note: "This layer creates value even if not a single participant ever receives a loan. Programmes can already measure attendance and completion; what they cannot easily show is operational progress and readiness for capital.",
  },
  {
    icon: Network,
    phase: "Layer 2",
    status: "Pilot — with a regulated partner's capital",
    title: "Qualification & Servicing",
    customer: "Women micro-entrepreneurs, served with a regulated financial partner in the pilot",
    revenue: "The cost to serve built into each loan's rate — originating, servicing and follow-up",
    risk: "In the pilot, with the regulated financial partner that provides the capital",
    note: "The output is not a lead. It is a qualified credit opportunity carrying readiness, data quality, business history, affordability, purpose, suggested ticket range, risk band, confidence and reason codes. In the pilot, the partner provides the capital and makes the credit decision; EmpowerFI prepares communities, qualifies requests, follows repayment and measures outcomes.",
  },
  {
    icon: Coins,
    phase: "Layer 3",
    status: "North Star — demonstrated on devnet",
    title: "P2P Capital Platform",
    customer: "Brazilian investors in reais, international and impact investors in USDC, and the entrepreneurs they fund",
    revenue: "The same cost to serve, built into each loan's rate",
    risk: "Depends on the regulated structure adopted",
    note: "Two pools of P2P capital fund qualified opportunities; a Capital Allocation Engine chooses the pool for each one, and EmpowerFI's P2P desk formalises and services the loan. It runs today as a prototype on devnet, with simulated money, and will operate under the applicable regulated structure once the pilot validates the model. EmpowerFI holds no such licence today.",
  },
];

const BusinessModelSectionEn = () => (
  <section id="business-model" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Business model"
        title="Three cumulative layers,"
        accent="one infrastructure."
        subtitle="Each layer is a business on its own terms. The next one does not replace the previous one — it is built on the distribution and the data the previous one produced."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {layers.map(({ icon: Icon, phase, status, title, customer, revenue, risk, note }) => (
          <div key={title} className="flex flex-col rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
                <Icon className="text-primary-foreground" size={22} />
              </div>
              <span className="font-mono text-xs text-accent">{phase}</span>
            </div>

            <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="mt-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {status}
            </p>

            <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
              {[
                ["Customer", customer],
                ["Revenue", revenue],
                ["Capital risk", risk],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-xs font-medium uppercase tracking-widest text-accent">
                    {term}
                  </dt>
                  <dd className="mt-0.5 leading-relaxed text-muted-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 flex-1 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
              {note}
            </p>
          </div>
        ))}
      </div>

      <p className="mx-auto max-w-3xl text-center font-heading text-lg font-semibold leading-relaxed text-foreground">
        EmpowerFI is paid by the cost to serve built into each loan's rate — preparing,
        originating and servicing small tickets — and{" "}
        <span className="text-gradient">
          by Community Intelligence for programmes and communities.
        </span>
      </p>
    </div>
  </section>
);

export default BusinessModelSectionEn;
