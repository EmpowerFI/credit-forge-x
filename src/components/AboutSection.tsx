import { Brain, Globe, Shield, Layers } from "lucide-react";

const techs = [
  { icon: Brain, label: "IA & Machine Learning" },
  { icon: Globe, label: "Open Finance" },
  { icon: Shield, label: "Capital tokenizado" },
  { icon: Layers, label: "Score proprietário" },
];

const AboutSection = () => (
  <section id="sobre" className="section-padding">
    <div className="container mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">Sobre a EmpowerFI</p>
          <h2 className="section-title">
            Uma fintech de crédito{" "}
            <span className="text-gradient">em construção, com tese validada</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            A EmpowerFI está sendo construída para resolver um gap concreto: microempreendedoras com renda variável, sem garantias formais, são consistentemente recusadas ou penalizadas com taxas abusivas pelo sistema bancário tradicional.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Nossa tese combina análise de fluxo de caixa via Open Finance, score baseado em comportamento financeiro, IA assistente em jornadas adaptativas, e captação de capital via tokenização com lastro em Tesouro brasileiro. O resultado projetado: crédito significativamente mais barato e acessível, com sustentabilidade econômica sem depender de subsídio filantrópico.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {techs.map(({ icon: Icon, label }) => (
            <div key={label} className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
              <Icon className="text-accent mb-3" size={28} />
              <p className="font-heading font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">Compõe nossa arquitetura</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default AboutSection;
