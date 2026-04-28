import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import DifferentialSection from "@/components/DifferentialSection";
import OpportunitySection from "@/components/OpportunitySection";
import TractionSection from "@/components/TractionSection";
import RoadmapSection from "@/components/RoadmapSection";
import BusinessModelSection from "@/components/BusinessModelSection";
import FAQSection from "@/components/FAQSection";
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
    <DifferentialSection />
    <OpportunitySection />
    <TractionSection />
    <RoadmapSection />
    <BusinessModelSection />
    <FAQSection />
    <CTASection />
    <Footer />
  </div>
);

export default Index;
