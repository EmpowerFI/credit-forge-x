import { FileCheck2, Globe2, Scale, ShieldCheck } from "lucide-react";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

// Two routes to the same business. The engine picks one per opportunity; she
// receives and repays in reais, by Pix, on either.
const domesticRoute = [
  { label: "Brazilian investors", emphasis: true },
  { label: "Domestic pool", sub: "Reais" },
  { label: "Allocation engine · P2P desk", emphasis: true },
  { label: "Pix" },
  { label: "Her business", sub: "Reais", emphasis: true },
];

const globalRoute = [
  { label: "International and impact investors", emphasis: true },
  { label: "Global pool", sub: "USDC on Solana" },
  { label: "Allocation engine · P2P desk", emphasis: true },
  { label: "Regulated off-ramp" },
  { label: "Pix" },
  { label: "Her business", sub: "Reais", emphasis: true },
];

const roles = [
  {
    icon: FileCheck2,
    title: "Proof layer — every loan",
    desc: "Commitments, attestations and lifecycle state are anchored on Solana for every loan, whichever pool funds it, so a critical event can be independently recomputed and verified. Solana is infrastructure inside the product, not the product.",
  },
  {
    icon: Globe2,
    title: "Capital rail — the global pool",
    desc: "For international and impact investors, USDC on Solana carries the capital to a regulated off-ramp, and on to her business by Pix. Brazilian investors' capital moves in reais, by Pix, and never needs the chain as a rail.",
  },
];

const toMeasure = [
  { icon: Scale, title: "What has to be measured", desc: "Ramp, FX, compliance, liquidity, custody, infrastructure and operations — everything a pool adds to her all-in rate. Cost decides only between pools that can take the opportunity." },
  { icon: ShieldCheck, title: "What must never happen", desc: "No name, document number, phone, email, bank detail, raw revenue or raw expense ever goes on-chain. Integrity and state are proved; financial life is not published." },
];

const CapitalRailSectionEn = () => (
  <section id="capital-rail" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Capital"
        title="Two pools of capital."
        accent="One engine to choose."
        subtitle="Two pools of P2P capital: Brazilian investors in reais, and international and impact investors in USDC on Solana. She receives and repays in reais, by Pix, whichever pool funds her."
      />

      <div className="space-y-10">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Domestic pool
          </p>
          <CapitalFlow
            steps={domesticRoute}
            caption="Brazilian investors fund in reais through the domestic pool. The Capital Allocation Engine allocates the opportunity, EmpowerFI's P2P desk formalises the loan, and it reaches her business by Pix."
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Global pool
          </p>
          <CapitalFlow
            steps={globalRoute}
            caption="International and impact investors fund in USDC on Solana through the global pool. After allocation and formalisation, a regulated off-ramp converts the capital to reais and it reaches her business by Pix. She never holds a wallet or needs to know a blockchain was involved."
          />
        </div>

        <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
          This is the P2P model, demonstrated in the devnet prototype, where investments, returns,
          FX and Pix settlement are simulated. It will operate under the applicable regulated
          structure; EmpowerFI holds no such licence today. In the pilot, a regulated financial
          partner provides the capital.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl p-10 text-center glass glow-border shadow-glow">
        <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Global capital earns its place{" "}
          <span className="text-gradient">by what it adds.</span>
        </p>
        <p className="leading-relaxed text-muted-foreground">
          A Capital Allocation Engine chooses the pool for each opportunity: first whether a pool
          can take it — liquidity, risk appetite, ticket, mandate — then which costs her less.
          Global capital earns its place by the availability, mandate or economics it adds — not
          by being on a blockchain.
        </p>
      </div>

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
