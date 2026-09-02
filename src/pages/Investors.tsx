import Seo from "@/components/Seo";
import FooterEn from "@/components/en/FooterEn";
import NavbarEn from "@/components/en/NavbarEn";
import InvestorHero from "@/components/investors/InvestorHero";
import InvestorThesis from "@/components/investors/InvestorThesis";
import InvestorWaitlistForm from "@/components/investors/InvestorWaitlistForm";
import PilotMetrics from "@/components/investors/PilotMetrics";
import { organizationSchema } from "@/config/structuredData";
import { INVESTOR_EMAIL } from "@/config/links";

const alternates = [
  { hreflang: "en", path: "/investors" },
  { hreflang: "x-default", path: "/investors" },
];

const jsonLd = [organizationSchema()];

/**
 * Investor-facing page: thesis, waitlist, and the shell that becomes the Public
 * Investor Dashboard once a real pilot produces figures.
 *
 * Nothing on this page may read as an offer. The waitlist collects non-binding
 * interest, the disclosure sits above the fold in InvestorHero, and every metric
 * stays empty until it is backed by a real pilot.
 */
const Investors = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Investors — EmpowerFI productive credit pilot"
      description="Join the waitlist for EmpowerFI's first productive microcredit pilot, connecting global capital with women-led microbusinesses in Brazil. Non-binding interest only."
      path="/investors"
      lang="en"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <NavbarEn />
    <InvestorHero />

    <section id="waitlist" className="section-padding">
      <div className="container mx-auto space-y-10">
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Investor waitlist
          </p>
          <h2 className="section-title !text-3xl md:!text-4xl">
            Be there when the <span className="text-gradient">first pilot opens.</span>
          </h2>
          <p className="section-subtitle">
            Tell us how you'd want to participate. It takes a minute, and commits you to
            nothing.
          </p>
        </div>

        <InvestorWaitlistForm />

        {/* Institutional investors usually want a person, not a form. */}
        <p className="text-center text-sm text-muted-foreground">
          Institutional enquiries can also go straight to{" "}
          <a
            href={`mailto:${INVESTOR_EMAIL}?subject=EmpowerFI%20productive%20credit%20pilot`}
            className="font-medium text-accent transition-colors hover:text-foreground"
          >
            {INVESTOR_EMAIL}
          </a>
          .
        </p>
      </div>
    </section>

    <InvestorThesis />
    <PilotMetrics />
    <FooterEn />
  </div>
);

export default Investors;
