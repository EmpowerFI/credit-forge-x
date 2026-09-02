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
 * This is NOT a translation of "/". The corporate thesis — global capital,
 * Solana, PSV, the pilot, the business model — is written for investors and
 * lives in English at "/" and "/investors". This page speaks to the woman who
 * runs the business: what EmpowerFI does for her, what productive credit is
 * for, and the app she can install today. The two pages tell the same story
 * from the two ends of the same chain, which is why the investor and moat
 * sections do not belong here.
 */
const IndexPt = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI — Crédito produtivo para o seu negócio"
      description="A EmpowerFI ajuda mulheres empreendedoras a organizar o negócio, construir histórico financeiro e se preparar para acessar crédito produtivo. App gratuito no Google Play."
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
