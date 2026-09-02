import { Award, Building2, ExternalLink, Smartphone } from "lucide-react";
import { PLAY_STORE_URL, SEBRAE_LOGO_SRC } from "@/config/links";
import SectionHeading from "@/components/SectionHeading";
import SupportLogo from "@/components/SupportLogo";

interface TractionLogo {
  src: string;
  alt: string;
  label: string;
}

const items: {
  icon: typeof Smartphone;
  title: string;
  desc: string;
  href?: string;
  linkLabel?: string;
  logo?: TractionLogo;
}[] = [
  {
    icon: Smartphone,
    title: "The app is live in Brazil",
    desc: "Published on Google Play and running. It is the part of the infrastructure that reaches the entrepreneur — where the business is tracked and the management signals behind credit intelligence are collected.",
    href: PLAY_STORE_URL,
    linkLabel: "View on Google Play",
  },
  {
    icon: Award,
    title: "Built and refined with Sebrae",
    desc: "Thesis validated in the field with Sebrae, one of Brazil's leading innovation references. EmpowerFI completed Ginga Prototipa, which produced the working prototype, and is now in PIER — a Sebrae programme for refining the business model with specialist consulting.",
    logo: { src: SEBRAE_LOGO_SRC, alt: "Sebrae", label: "Institutional support" },
  },
  {
    icon: Building2,
    title: "An operating company in Brazil",
    desc: "A company incorporated in São Paulo, with its team, product and first market in Brazil. We build for the context we know first-hand.",
  },
];

const TractionSectionEn = () => (
  <section id="traction" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Traction"
        title="What's already"
        accent="real and verifiable."
        subtitle="No inflated numbers, no projections presented as results. Everything here can be checked today."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {items.map(({ icon: Icon, title, desc, href, linkLabel, logo }) => (
          <div key={title} className="flex flex-col rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="flex-1 leading-relaxed text-muted-foreground">{desc}</p>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-foreground"
              >
                {linkLabel} <ExternalLink size={14} />
              </a>
            )}
            {logo && <SupportLogo {...logo} />}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TractionSectionEn;
