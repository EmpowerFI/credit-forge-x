import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlayStoreBadge from "@/components/PlayStoreBadge";

const HeroSectionEn = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden gradient-subtle">
    {/* Decorative brand glows — replace the old hero photo. */}
    <div className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full bg-accent/10 blur-3xl" />
    <div className="absolute -bottom-24 left-1/4 w-[24rem] h-[24rem] rounded-full bg-primary/5 blur-3xl" />

    <div className="relative container mx-auto px-4 pt-28 pb-16">
      <div className="max-w-3xl space-y-7">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-border text-xs text-accent font-medium opacity-0 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
          Global financial infrastructure · starting in Brazil
        </div>

        <h1 className="section-title !text-4xl md:!text-6xl !leading-[1.08] opacity-0 animate-fade-in-delay-1">
          We connect women micro-entrepreneurs to new clients — and build the{" "}
          <span className="text-gradient">financial history banks never recognized</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl opacity-0 animate-fade-in-delay-2">
          A marketplace that generates income and data, turns that history into a score, and unlocks access to credit and impact capital. There are <span className="text-foreground font-medium">7 million+ women entrepreneurs invisible</span> to the financial system in Brazil.
        </p>

        <div className="space-y-5 pt-2 opacity-0 animate-fade-in-delay-3">
          <PlayStoreBadge eyebrow="Live on" justLaunched="Just launched" />

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
              <a href="#investors">
                For investors / partners <ArrowRight size={18} />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSectionEn;
