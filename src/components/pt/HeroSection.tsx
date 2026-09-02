import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlayStoreBadge from "@/components/PlayStoreBadge";

const HeroSection = () => (
  <section className="relative flex min-h-screen items-center overflow-hidden gradient-subtle">
    {/* Brilhos decorativos da marca. */}
    <div className="absolute -right-24 -top-32 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl" />
    <div className="absolute -bottom-24 left-1/4 h-[24rem] w-[24rem] rounded-full bg-primary/5 blur-3xl" />

    <div className="container relative mx-auto px-4 pb-16 pt-28">
      <div className="max-w-3xl space-y-7">
        <div className="inline-flex animate-fade-in items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent opacity-0 glow-border">
          <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent" />
          App no ar no Brasil · piloto de crédito em preparação
        </div>

        <h1 className="section-title !text-4xl !leading-[1.08] opacity-0 animate-fade-in-delay-1 md:!text-6xl">
          Seu negócio já funciona. Falta{" "}
          <span className="text-gradient">o capital para ele crescer.</span>
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground opacity-0 animate-fade-in-delay-2 md:text-xl">
          A EmpowerFI ajuda você a organizar o negócio, construir um histórico financeiro
          de verdade e se preparar para acessar crédito produtivo — aquele que entra no
          negócio e volta como faturamento.
        </p>

        <div className="space-y-5 pt-2 opacity-0 animate-fade-in-delay-3">
          <PlayStoreBadge eyebrow="Baixe agora no" justLaunched="Disponível no Brasil" />

          <div className="flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="gap-2 border-primary/40 text-foreground hover:bg-primary/10"
            >
              <a href="#como-funciona">
                Como funciona <ArrowRight size={18} />
              </a>
            </Button>
          </div>

          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />
            Estamos preparando nosso primeiro piloto de microcrédito produtivo no Brasil.
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
