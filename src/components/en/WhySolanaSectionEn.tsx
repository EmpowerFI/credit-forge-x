import { FileCheck2, Gauge, Globe2, Wallet } from "lucide-react";
import SectionHeading from "./SectionHeading";

const properties = [
  {
    icon: Gauge,
    title: "Low-cost settlement",
    desc: "Small transactions remain economically viable.",
  },
  {
    icon: Wallet,
    title: "Stablecoin liquidity",
    desc: "Global capital can move using stablecoins such as USDC.",
  },
  {
    icon: Globe2,
    title: "Fast settlement",
    desc: "Capital and repayments can move efficiently across borders.",
  },
  {
    icon: FileCheck2,
    title: "Verifiable credit activity",
    desc: "Loan activity and repayment history can generate auditable financial records without exposing borrower identity.",
  },
];

const roles = [
  { role: "Investor", value: "USDC" },
  { role: "Entrepreneur", value: "Local currency / Pix" },
  { role: "Infrastructure", value: "Solana" },
];

const WhySolanaSectionEn = () => (
  <section id="why-solana" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Infrastructure"
        title="Why"
        accent="Solana?"
        subtitle="Small loans require extremely efficient financial infrastructure. When the loan itself is only $50–$200, traditional cross-border infrastructure can make the economics impossible."
      />

      <p className="mx-auto max-w-3xl text-center text-lg leading-relaxed text-foreground">
        EmpowerFI uses Solana as a settlement and verification layer for productive credit.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {properties.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={20} />
            </div>
            <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl p-10 glass glow-border shadow-glow">
        <p className="text-center font-heading text-2xl font-bold text-foreground md:text-3xl">
          The entrepreneur doesn't need to{" "}
          <span className="text-gradient">understand crypto.</span>
        </p>

        <dl className="grid gap-4 sm:grid-cols-3">
          {roles.map(({ role, value }) => (
            <div
              key={role}
              className="rounded-xl border border-border bg-card/60 px-5 py-4 text-center"
            >
              <dt className="text-xs font-medium uppercase tracking-widest text-accent">
                {role}
              </dt>
              <dd className="mt-1.5 font-heading font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  </section>
);

export default WhySolanaSectionEn;
