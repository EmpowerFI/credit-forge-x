import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden">
    <div className="absolute inset-0">
      <img src={heroBg} alt="Microempreendedora atendendo cliente em seu negócio" width={1920} height={1080}
        className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
    </div>

    <div className="relative container mx-auto px-4 pt-24 pb-16">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-border text-xs text-accent font-medium opacity-0 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
          Acelerada pelo Sebrae — Programa Ginga Prototipa
        </div>

        <h1 className="section-title !text-4xl md:!text-5xl lg:!text-6xl leading-tight opacity-0 animate-fade-in-delay-1">
          Estamos construindo a fintech de crédito para{" "}
          <span className="text-gradient">microempreendedoras invisíveis</span>{" "}
          ao sistema bancário tradicional
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl opacity-0 animate-fade-in-delay-2">
          Combinamos Open Finance, score baseado em comportamento, IA assistente e capital tokenizado. Em fase de desenvolvimento, com tese validada e tração inicial.
        </p>

        <div className="flex flex-wrap gap-4 pt-2 opacity-0 animate-fade-in-delay-3">
          <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            Sou investidor <ArrowRight size={18} />
          </Button>
          <Button size="lg" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
            Quero ser parceira institucional
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
