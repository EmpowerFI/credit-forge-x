import CapitalFlow from "./CapitalFlow";
import SectionHeading from "./SectionHeading";

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
        title="Starting with women entrepreneurs"
        accent="in Brazil."
        subtitle="Brazil is EmpowerFI's first market and laboratory."
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
            EmpowerFI will begin by testing small productive loans with women-led businesses
            and verified local communities — small enough to learn from, real enough to
            prove the model.
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
