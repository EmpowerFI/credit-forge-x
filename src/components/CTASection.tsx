import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => (
  <section className="section-padding">
    <div className="container mx-auto text-center">
      <div className="glass rounded-2xl p-10 md:p-16 glow-border shadow-glow max-w-3xl mx-auto space-y-6">
        <h2 className="section-title !text-3xl md:!text-4xl">
          Crédito justo, decisão em minutos,{" "}
          <span className="text-gradient">sem letra miúda.</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Cliente, parceira institucional ou fundo de investimento — fale com o time e descubra como a EmpowerFI funciona na prática.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            Quero conhecer meu crédito <ArrowRight size={18} />
          </Button>
          <Button size="lg" variant="outline" className="border-primary/40 text-foreground hover:bg-primary/10 gap-2">
            Sou investidor, quero saber mais
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default CTASection;
