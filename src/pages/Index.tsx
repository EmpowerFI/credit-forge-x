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

// The English home declares its own meta, word for word what index.html
// carries, so crawlers and link previews read the same page whether or not they
// run JavaScript.
const alternates = [
  { hreflang: "en", path: "/" },
  { hreflang: "pt-BR", path: "/pt" },
  { hreflang: "x-default", path: "/" },
];

const jsonLd = [organizationSchema()];

/**
 * The corporate site's front door, in English: EmpowerFI as P2P productive
 * credit — preparation before credit, qualified opportunities, two pools of
 * capital chosen by an allocation engine, servicing after disbursement, and
 * every step proven on Solana. The entrepreneur-facing product lives on at /pt,
 * in Portuguese.
 *
 * Section order follows the argument an investor reads in: what is broken, what
 * we built, how it works, why readiness is not eligibility, how it earns money,
 * how big the market is, where we start, what is already real — and only then
 * the two pools and the engine, which fund what the earlier sections qualify.
 * The pilot comes after them: it runs on a regulated partner's capital, and the
 * pools are where the model goes once it validates.
 */
const Index = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI — P2P productive credit, from readiness to capital"
      description="P2P productive credit for women micro-entrepreneurs in Brazil, from readiness to capital, with every step proven on Solana. Two pools of investors, in reais and in USDC; a working prototype on devnet."
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
