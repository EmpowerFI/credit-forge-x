import { Award } from "lucide-react";

const TractionSection = () => (
  <section className="section-padding gradient-subtle">
    <div className="container mx-auto text-center">
      <div className="glass rounded-2xl p-10 md:p-16 glow-border shadow-glow max-w-3xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto">
          <Award className="text-primary-foreground" size={32} />
        </div>
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Tração</p>
        <h2 className="section-title !text-2xl md:!text-3xl">
          Selecionada para o programa <span className="text-gradient">Prototipa do Sebrae</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
          A validação pelo Sebrae reforça o potencial da solução e seu impacto no ecossistema de 
          empreendedorismo feminino e inclusão financeira no Brasil.
        </p>
      </div>
    </div>
  </section>
);

export default TractionSection;
