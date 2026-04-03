import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import DifferentialSection from "@/components/DifferentialSection";
import OpportunitySection from "@/components/OpportunitySection";
import TractionSection from "@/components/TractionSection";
import RoadmapSection from "@/components/RoadmapSection";
import BusinessModelSection from "@/components/BusinessModelSection";

import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <AboutSection />
    <ProblemSection />
    <SolutionSection />
    <DifferentialSection />
    <OpportunitySection />
    <TractionSection />
    <RoadmapSection />
    <BusinessModelSection />
    <NewsSection />
    <CTASection />
    <Footer />
  </div>
);

export default Index;
