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

const jsonLd = [organizationSchema(), softwareApplicationSchema()];

/**
 * The page for the woman who runs the business, in Portuguese: how she
 * prepares, where the capital comes from in each phase, that she receives and
 * repays in reais by Pix, and the app she can install today. It was the
 * Portuguese home until the home page told the whole loop (16 Sep).
 */
const EmpreendedorasPt = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI para empreendedoras — organize o negócio e prepare-se para o crédito"
      description="Organize o negócio, construa seu histórico e se prepare para o crédito produtivo. Você recebe e paga em reais, por Pix, e cada etapa é comprovada na Solana sem dados pessoais. App gratuito no Google Play."
      path="/pt/empreendedoras"
      lang="pt-BR"
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

export default EmpreendedorasPt;
