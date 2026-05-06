import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import OpportunitySection from "@/components/OpportunitySection";
import TractionSection from "@/components/TractionSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <AboutSection />
    <ProblemSection />
    <SolutionSection />
    <HowItWorksSection />
    <OpportunitySection />
    <TractionSection />
    <CTASection />
    <Footer />
  </div>
);

export default Index;
