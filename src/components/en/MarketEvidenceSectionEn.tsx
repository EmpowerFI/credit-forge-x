import SectionHeading from "@/components/SectionHeading";

const brazil = [
  {
    figure: "9.96M",
    desc: "active businesses in Brazil led by women.",
    source: "MEMP / Mapa de Empresas, 2026",
  },
  {
    figure: "39.7%",
    desc: "of active Brazilian businesses are led by women.",
    source: "MEMP / Mapa de Empresas, 2026",
  },
  {
    figure: "94%",
    desc: "of active businesses in the country are small businesses.",
    source: "MEMP / Mapa de Empresas, 2026",
  },
  {
    figure: "2.6% / 4.6%",
    desc: "of women-owned micro and small enterprises access formal loans, against 4.6% of men-owned ones in the same study.",
    source: "IFC + Sicredi, 2025",
  },
  {
    figure: "US$15.8B",
    desc: "estimated financing gap for women-owned micro and small enterprises in Brazil.",
    source: "IFC + Sicredi, 2025",
  },
  {
    figure: "R$3,101",
    desc: "average ticket across 3.89 million loans disbursed by Crediamigo in 2024 — small-ticket microcredit already operates at scale in Brazil.",
    source: "Banco do Nordeste, Crediamigo report 2024",
  },
];

// These are the sentences that keep the numbers honest. They stay on the page
// on purpose: an investor running diligence will check them anyway, and the
// version that states its own limits is the one that survives the check.
const readings = [
  {
    title: "2.6% is not a denial rate",
    desc: "It measures access to formal loans in the cited sample. It does not mean 97.4% of women were refused credit, and we do not use it that way.",
  },
  {
    title: "Crediamigo is a scale benchmark",
    desc: "It shows that tickets near our initial range exist at relevant volume in Brazil. It is not a comparison of technology or audience.",
  },
  {
    title: "A financing gap is not a revenue market",
    desc: "The US$15.8B gap — and the US$1.9 trillion attributed to women-owned MSMEs in emerging markets by IFC/G20 — is unmet need, not addressable revenue.",
  },
];

const MarketEvidenceSectionEn = () => (
  <section id="market" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Market evidence"
        title="The scale is documented."
        accent="So is the gap."
        subtitle="Every figure below carries its source and its year. Where a number is commonly misread, we say how it should be read instead."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {brazil.map(({ figure, desc, source }) => (
          <div key={figure} className="flex flex-col rounded-xl p-6 glass glow-border">
            <p className="font-heading text-3xl font-bold text-gradient">{figure}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              {source}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card/50 p-8 md:p-10">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          How to read these numbers
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {readings.map(({ title, desc }) => (
            <div key={title}>
              <h3 className="mb-1.5 font-heading font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default MarketEvidenceSectionEn;
