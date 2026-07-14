import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import DifferentialSection from "@/components/DifferentialSection";
import TractionSection from "@/components/TractionSection";
import CTASection from "@/components/CTASection";
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
    <Footer />
  </div>
);

export default Index;
