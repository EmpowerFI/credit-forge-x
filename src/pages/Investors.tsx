import Seo from "@/components/Seo";
import FooterEn from "@/components/en/FooterEn";
import NavbarEn from "@/components/en/NavbarEn";
import InvestorHero from "@/components/investors/InvestorHero";
import InvestorThesis from "@/components/investors/InvestorThesis";
import InvestorWaitlistSection from "@/components/investors/InvestorWaitlistSection";
import PilotMetrics from "@/components/investors/PilotMetrics";
import { organizationSchema } from "@/config/structuredData";

const alternates = [
  { hreflang: "en", path: "/investors" },
  { hreflang: "pt-BR", path: "/pt/investidores" },
  { hreflang: "x-default", path: "/investors" },
];

const jsonLd = [organizationSchema()];

/**
 * Investor-facing page, in English: the two P2P pools (reais and USDC), the
 * thesis and its phases, the waitlist, and the shell that becomes the Public
 * Investor Dashboard once real P2P operations produce figures.
 * /pt/investidores carries the same substance for Brazilian investors; the
 * words of both live side by side in components/investors/copy.ts.
 *
 * Nothing on this page may read as an offer. The waitlist collects non-binding
 * interest, the prototype disclaimer and the not-an-offer line sit above the
 * fold in InvestorHero, and every metric stays empty until it is real.
 */
const Investors = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Investors — EmpowerFI P2P productive credit"
      description="P2P productive credit for women-led businesses in Brazil, funded through two pools: Brazilian investors in reais, and international and impact investors in USDC. A working prototype on Solana devnet today. Join the non-binding waitlist."
      path="/investors"
      lang="en"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <NavbarEn />
    <InvestorHero lang="en" path="/investors" />
    <InvestorWaitlistSection lang="en" />
    <InvestorThesis lang="en" />
    <PilotMetrics lang="en" />
    <FooterEn />
  </div>
);

export default Investors;
