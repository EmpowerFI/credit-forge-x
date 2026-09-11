import { FileCheck2, Globe2, Scale, ShieldCheck } from "lucide-react";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const crossBorder = [
  { label: "Global investor", emphasis: true },
  { label: "Stablecoin" },
  { label: "Capital infrastructure", emphasis: true },
  { label: "Regulated on/off-ramp" },
  { label: "Pix · local rail" },
  { label: "Business", sub: "Local currency", emphasis: true },
];

const roles = [
  {
    icon: FileCheck2,
    title: "Proof layer — today",
    desc: "Commitments, attestations and lifecycle state are anchored on Solana so a critical event can be independently recomputed and verified. This is what the infrastructure uses the chain for now.",
  },
  {
    icon: Globe2,
    title: "Capital rail — later",
    desc: "Stablecoins can carry capital across borders and connect international investors to local operations, once the capital layer exists and the legal structure supports it.",
  },
];

const toMeasure = [
  { icon: Scale, title: "What has to be measured", desc: "Ramp, FX, compliance, liquidity, custody, infrastructure and operations. A rail is only better if the total cost to the borrower is better." },
  { icon: ShieldCheck, title: "What must never happen", desc: "No name, document number, phone, email, bank detail, raw revenue or raw expense ever goes on-chain. Integrity and state are proved; financial life is not published." },
];

const CapitalRailSectionEn = () => (
  <section id="capital-rail" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Capital rail"
        title="Optimize the economics of credit —"
        accent="not the blockchain."
        subtitle="Solana is infrastructure inside the product, not the product. It earns its place where it measurably improves the economics, and nowhere else."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {roles.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <CapitalFlow
        steps={crossBorder}
        caption="A possible cross-border route: investor capital travels as stablecoins, converts through a regulated on/off-ramp, and arrives over Pix as local currency. The entrepreneur never holds a wallet or needs to know a blockchain was involved."
      />

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          In Brazil, Pix may simply{" "}
          <span className="text-gradient">be the better rail.</span>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Pix is already extremely efficient, and the best domestic route may not need a
          blockchain at all. We treat that as a finding to respect rather than a problem to
          argue around. Where stablecoins earn their place is cross-border capital — moving
          money into the country, not around inside it.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {toMeasure.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-border bg-card/50 p-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={20} />
            </div>
            <h3 className="mb-2 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <p className="mx-auto max-w-3xl text-center font-heading text-lg font-semibold leading-relaxed text-foreground">
        Auditability{" "}
        <span className="text-gradient">without financial surveillance.</span>
      </p>
    </div>
  </section>
);

export default CapitalRailSectionEn;
