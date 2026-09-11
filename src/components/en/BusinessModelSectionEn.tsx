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
    revenue: "B2B contract per programme or cohort, licence and reporting",
    risk: "No capital risk",
    note: "This layer creates value even if not a single participant ever receives a loan. Programmes can already measure attendance and completion; what they cannot easily show is operational progress and readiness for capital.",
  },
  {
    icon: Network,
    phase: "Layer 2",
    status: "Pilot",
    title: "Origination Infrastructure",
    customer: "Microcredit institutions, banks, fintech lenders",
    revenue: "Origination, transaction and servicing fees",
    risk: "Capital risk sits with the partner",
    note: "The output is not a lead. It is a qualified credit opportunity carrying readiness, data quality, business history, affordability, purpose, suggested ticket range, risk band, confidence and reason codes — with the partner keeping its own policy, underwriting and final decision.",
  },
  {
    icon: Coins,
    phase: "Layer 3",
    status: "Future — subject to regulatory structure",
    title: "Capital Platform",
    customer: "Investors and entrepreneurs",
    revenue: "Fees, servicing and financial spread",
    risk: "Depends on the structure adopted",
    note: "Only after distribution, readiness, origination, servicing, repayment and unit economics have been validated. Guided P2P productive credit connecting national and international capital to businesses qualified by the same infrastructure.",
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
        We start asset-light and evolve toward a capital platform connecting qualified
        businesses to{" "}
        <span className="text-gradient">the most efficient source of funding.</span>
      </p>
    </div>
  </section>
);

export default BusinessModelSectionEn;
