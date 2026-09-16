import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const expansion = [
  { label: "Brazil", sub: "First market", emphasis: true },
  { label: "Latin America" },
  { label: "Emerging markets" },
];

const FirstMarketSectionEn = () => (
  <section id="first-market" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="First market"
        title="Brazil as the laboratory."
        accent="Architecture ready for more."
        subtitle="Brazil is the first market because the conditions are unusually good for testing: scale, a mature instant-payment rail, and established microcredit and public programmes. The core travels; regulation, payment rails and the last mile change by country."
      />

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="glass rounded-2xl p-8 glow-border">
          <h3 className="mb-2 font-heading text-lg font-bold text-foreground">
            Where the gap is widest
          </h3>
          <p className="leading-relaxed text-muted-foreground">
            Women microentrepreneurs frequently operate small businesses with limited access
            to appropriate productive credit — businesses that work, but that no risk model
            was built to read.
          </p>
        </div>
        <div className="glass rounded-2xl p-8 glow-border">
          <h3 className="mb-2 font-heading text-lg font-bold text-foreground">
            How we begin
          </h3>
          <p className="leading-relaxed text-muted-foreground">
            EmpowerFI will begin with a pilot of small productive loans for women-led businesses
            in verified local communities, funded by a regulated financial partner's capital —
            small enough to learn from, real enough to prove the model. P2P investors come in
            the next phase.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <p className="text-center font-heading text-xl font-bold text-foreground md:text-2xl">
          Brazil is the starting point — <span className="text-gradient">not the limit.</span>
        </p>
        <CapitalFlow
          steps={expansion}
          caption="EmpowerFI starts in Brazil, then Latin America, then other emerging markets."
        />
      </div>
    </div>
  </section>
);

export default FirstMarketSectionEn;
