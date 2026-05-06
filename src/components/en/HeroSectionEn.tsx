import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSectionEn = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden">
    <div className="absolute inset-0">
      <img src={heroBg} alt="Microentrepreneur serving a customer at her business" width={1920} height={1080}
        className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
    </div>

    <div className="relative container mx-auto px-4 pt-24 pb-16">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-border text-xs text-accent font-medium opacity-0 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
          Accelerated by Sebrae — Ginga Prototipa Program
        </div>

        <h1 className="section-title !text-4xl md:!text-5xl lg:!text-6xl leading-tight opacity-0 animate-fade-in-delay-1">
          We are building the credit fintech for{" "}
          <span className="text-gradient">microentrepreneurs invisible</span>{" "}
          to the traditional banking system
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl opacity-0 animate-fade-in-delay-2">
          We combine Open Finance, behavior-based scoring, AI assistance and tokenized capital. In development, with a validated thesis and early traction.
        </p>

        <div className="flex flex-wrap gap-4 pt-2 opacity-0 animate-fade-in-delay-3">
          <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            I'm an investor <ArrowRight size={18} />
          </Button>
          <Button size="lg" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
            Become an institutional partner
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSectionEn;
