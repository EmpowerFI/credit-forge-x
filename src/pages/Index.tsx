import Seo from "@/components/Seo";
import BusinessModelSectionEn from "@/components/en/BusinessModelSectionEn";
import CreditIntelligenceSectionEn from "@/components/en/CreditIntelligenceSectionEn";
import FirstMarketSectionEn from "@/components/en/FirstMarketSectionEn";
import FooterEn from "@/components/en/FooterEn";
import ForEntrepreneursSectionEn from "@/components/en/ForEntrepreneursSectionEn";
import ForPartnersSectionEn from "@/components/en/ForPartnersSectionEn";
import HeroSectionEn from "@/components/en/HeroSectionEn";
import HowItWorksSectionEn from "@/components/en/HowItWorksSectionEn";
import ImpactSectionEn from "@/components/en/ImpactSectionEn";
import NavbarEn from "@/components/en/NavbarEn";
import PilotSectionEn from "@/components/en/PilotSectionEn";
import ProblemSectionEn from "@/components/en/ProblemSectionEn";
import ProductiveCapitalSectionEn from "@/components/en/ProductiveCapitalSectionEn";
import SolutionSectionEn from "@/components/en/SolutionSectionEn";
import TractionSectionEn from "@/components/en/TractionSectionEn";
import WhySolanaSectionEn from "@/components/en/WhySolanaSectionEn";
import { organizationSchema } from "@/config/structuredData";

// index.html still carries the Portuguese meta it shipped with, so the English
// home has to declare its own — otherwise it would advertise itself to crawlers
// and link previews as pt-BR.
const alternates = [
  { hreflang: "en", path: "/" },
  { hreflang: "pt-BR", path: "/pt" },
  { hreflang: "x-default", path: "/" },
];

const jsonLd = [organizationSchema()];

/**
 * The corporate site's front door, in English: EmpowerFI as credit
 * infrastructure connecting global capital to microbusinesses. The
 * entrepreneur-facing product lives on at /pt, in Portuguese.
 */
const Index = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI — Credit infrastructure for the next generation of entrepreneurs"
      description="EmpowerFI connects global capital with underserved microbusinesses in emerging markets — starting with women entrepreneurs in Brazil. Turning global liquidity into productive capital."
      path="/"
      lang="en"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <NavbarEn />
    <HeroSectionEn />
    <ProblemSectionEn />
    <SolutionSectionEn />
    <WhySolanaSectionEn />
    <ProductiveCapitalSectionEn />
    <HowItWorksSectionEn />
    <CreditIntelligenceSectionEn />
    <ImpactSectionEn />
    <FirstMarketSectionEn />
    <TractionSectionEn />
    <BusinessModelSectionEn />
    <PilotSectionEn />
    <ForEntrepreneursSectionEn />
    <ForPartnersSectionEn />
    <FooterEn />
  </div>
);

export default Index;
