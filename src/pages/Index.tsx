import Seo from "@/components/Seo";
import BusinessModelSectionEn from "@/components/en/BusinessModelSectionEn";
import CapitalRailSectionEn from "@/components/en/CapitalRailSectionEn";
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
import MarketEvidenceSectionEn from "@/components/en/MarketEvidenceSectionEn";
import SolutionSectionEn from "@/components/en/SolutionSectionEn";
import TractionSectionEn from "@/components/en/TractionSectionEn";
import ReadinessSectionEn from "@/components/en/ReadinessSectionEn";
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
 * The corporate site's front door, in English: EmpowerFI as productive-credit
 * infrastructure — preparation before credit, qualified origination, servicing
 * after disbursement. The entrepreneur-facing product lives on at /pt, in
 * Portuguese.
 *
 * Section order follows the argument an investor reads in: what is broken, what
 * we built, how it works, why readiness is not eligibility, how it earns money,
 * how big the market is, where we start, what is already real — and only then
 * the capital rail, which is infrastructure inside the product rather than the
 * pitch.
 */
const Index = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI — Productive-credit infrastructure, from readiness to capital"
      description="EmpowerFI is productive-credit infrastructure that turns entrepreneur communities and education programmes into qualified credit pipelines — preparing businesses before credit, originating better, servicing continuously and measuring outcomes."
      path="/"
      lang="en"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <NavbarEn />
    <HeroSectionEn />
    <ProblemSectionEn />
    <SolutionSectionEn />
    <HowItWorksSectionEn />
    <ReadinessSectionEn />
    <BusinessModelSectionEn />
    <MarketEvidenceSectionEn />
    <FirstMarketSectionEn />
    <TractionSectionEn />
    <CapitalRailSectionEn />
    <ImpactSectionEn />
    <PilotSectionEn />
    <ForEntrepreneursSectionEn />
    <ForPartnersSectionEn />
    <FooterEn />
  </div>
);

export default Index;
