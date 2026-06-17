import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlayStoreBadge from "@/components/PlayStoreBadge";

const HeroSection = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden gradient-subtle">
    {/* Decorative brand glows — replace the old hero photo. */}
    <div className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full bg-accent/10 blur-3xl" />
    <div className="absolute -bottom-24 left-1/4 w-[24rem] h-[24rem] rounded-full bg-primary/5 blur-3xl" />

    <div className="relative container mx-auto px-4 pt-28 pb-16">
      <div className="max-w-3xl space-y-7">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-border text-xs text-accent font-medium opacity-0 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
          Infraestrutura financeira global · começando pelo Brasil
        </div>

        <h1 className="section-title !text-4xl md:!text-6xl !leading-[1.08] opacity-0 animate-fade-in-delay-1">
          Conectamos microempreendedoras a novos clientes — e construímos o{" "}
          <span className="text-gradient">histórico financeiro que os bancos nunca enxergaram</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl opacity-0 animate-fade-in-delay-2">
          Um marketplace que gera renda e dados, transforma esse histórico em score e abre acesso a crédito e capital de impacto. São <span className="text-foreground font-medium">7 milhões+ de mulheres empreendedoras invisíveis</span> ao sistema financeiro no Brasil.
        </p>

        <div className="space-y-5 pt-2 opacity-0 animate-fade-in-delay-3">
          <PlayStoreBadge eyebrow="Ao vivo no" justLaunched="Acabou de lançar" />

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
              <a href="#investidores">
                Para investidores / parceiros <ArrowRight size={18} />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
