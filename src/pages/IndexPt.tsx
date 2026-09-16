import Seo from "@/components/Seo";
import AppSection from "@/components/pt/AppSection";
import CTASection from "@/components/pt/CTASection";
import CreditoProdutivoSection from "@/components/pt/CreditoProdutivoSection";
import Footer from "@/components/pt/Footer";
import HeroSection from "@/components/pt/HeroSection";
import HowItWorksSection from "@/components/pt/HowItWorksSection";
import Navbar from "@/components/pt/Navbar";
import ProblemSection from "@/components/pt/ProblemSection";
import TractionSection from "@/components/pt/TractionSection";
import { organizationSchema, softwareApplicationSchema } from "@/config/structuredData";

// index.html carries the English corporate meta, so the Portuguese page has to
// declare its own — otherwise it would advertise itself to crawlers and link
// previews as the English page.
const alternates = [
  { hreflang: "en", path: "/" },
  { hreflang: "pt-BR", path: "/pt" },
  { hreflang: "x-default", path: "/" },
];

const jsonLd = [organizationSchema(), softwareApplicationSchema()];

/**
 * The entrepreneur-facing page, in Portuguese.
 *
 * This is NOT a translation of "/". The corporate thesis — the two P2P capital
 * pools, the Capital Allocation Engine, the pilot, the business model — is
 * written for investors and lives at "/" and "/investors" in English, and at
 * "/pt/investidores" for Brazilian investors. This page speaks to the woman who
 * runs the business: how she prepares, where the capital comes from in each
 * phase (the partner in the pilot, P2P investors after), that she receives and
 * repays in reais by Pix, and the app she can install today. Blockchain appears
 * only as how each step is proven. The pages tell the same story from the two
 * ends of the same chain, which is why the investor sections do not belong here.
 */
const IndexPt = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI — Crédito produtivo P2P para mulheres empreendedoras no Brasil"
      description="Crédito produtivo P2P para mulheres empreendedoras no Brasil, da prontidão ao capital, com cada etapa comprovada na Solana. Organize o negócio, construa seu histórico e se prepare para o crédito. App gratuito no Google Play."
      path="/pt"
      lang="pt-BR"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <Navbar />
    <HeroSection />
    <ProblemSection />
    <HowItWorksSection />
    <CreditoProdutivoSection />
    <AppSection />
    <TractionSection />
    <CTASection />
    <Footer />
  </div>
);

export default IndexPt;
