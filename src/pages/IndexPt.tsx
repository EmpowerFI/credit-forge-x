import Seo from "@/components/Seo";
import CTASection from "@/components/pt/CTASection";
import DifferentialSection from "@/components/pt/DifferentialSection";
import Footer from "@/components/pt/Footer";
import HeroSection from "@/components/pt/HeroSection";
import HowItWorksSection from "@/components/pt/HowItWorksSection";
import Navbar from "@/components/pt/Navbar";
import ProblemSection from "@/components/pt/ProblemSection";
import TractionSection from "@/components/pt/TractionSection";
import { organizationSchema, softwareApplicationSchema } from "@/config/structuredData";

// index.html carries the English corporate meta, so the Portuguese home has to
// declare its own — otherwise it would advertise itself to crawlers and link
// previews as the English page.
const alternates = [
  { hreflang: "en", path: "/" },
  { hreflang: "pt-BR", path: "/pt" },
  { hreflang: "x-default", path: "/" },
];

const jsonLd = [organizationSchema(), softwareApplicationSchema()];

/**
 * The entrepreneur-facing page, in Portuguese. The corporate positioning is now
 * carried by the English site at "/"; this page speaks to the women who use the
 * app, which is the audience that has always read it in Portuguese.
 */
const IndexPt = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI — Infraestrutura financeira para empreendedoras"
      description="Conectamos microempreendedoras a novos clientes, construímos o histórico financeiro que os bancos nunca enxergaram e abrimos acesso a crédito produtivo. App no ar no Google Play."
      path="/pt"
      lang="pt-BR"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <Navbar />
    <HeroSection />
    <ProblemSection />
    <HowItWorksSection />
    <DifferentialSection />
    <TractionSection />
    <CTASection />
    <Footer />
  </div>
);

export default IndexPt;
