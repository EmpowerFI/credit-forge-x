import { FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => (
  <section className="section-padding">
    <div className="container mx-auto text-center">
      <div className="glass rounded-2xl p-10 md:p-16 glow-border shadow-glow max-w-3xl mx-auto space-y-6">
        <h2 className="section-title !text-3xl md:!text-4xl">
          Estamos construindo o <span className="text-gradient">futuro do crédito.</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Junte-se a nós nessa jornada. Seja investidor, parceiro ou parte do time que está mudando o sistema financeiro.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          <Button size="lg" variant="outline" className="border-primary/30 text-foreground hover:bg-primary/10 gap-2">
            Falar com o time <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default CTASection;
