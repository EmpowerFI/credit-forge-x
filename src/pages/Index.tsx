import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import DifferentialSection from "@/components/DifferentialSection";
import TractionSection from "@/components/TractionSection";
import CTASection from "@/components/CTASection";
import InstitutionalTeaser from "@/components/InstitutionalTeaser";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <ProblemSection />
    <HowItWorksSection />
    <DifferentialSection />
    <TractionSection />
    <CTASection />
    <InstitutionalTeaser
      title="Conheça a EmpowerFI"
      body="A EmpowerFI está construindo infraestrutura financeira para mulheres empreendedoras. Conheça nossa missão, nossa história e a visão de longo prazo por trás da plataforma."
      cta="Conheça nossa história"
      to="/about"
    />
    <Footer />
  </div>
);

export default Index;
