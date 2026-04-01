import { Brain, Globe, Shield, Layers } from "lucide-react";

const techs = [
  { icon: Brain, label: "IA & Machine Learning" },
  { icon: Globe, label: "Open Finance" },
  { icon: Shield, label: "Blockchain" },
  { icon: Layers, label: "Score Proprietário" },
];

const AboutSection = () => (
  <section id="sobre" className="section-padding">
    <div className="container mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">Sobre a EmpowerFI</p>
          <h2 className="section-title">
            Um <span className="text-gradient">neobank global</span> em construção
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            A EmpowerFI está criando um novo modelo de crédito focado em empresas lideradas por mulheres. 
            Nosso sistema é baseado em fluxo de caixa real, comportamento financeiro e reputação on-chain — 
            não em histórico bancário ultrapassado.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Combinamos inteligência artificial, machine learning, Open Finance e blockchain para construir 
            uma infraestrutura de crédito que entende a nova economia.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {techs.map(({ icon: Icon, label }) => (
            <div key={label} className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
              <Icon className="text-accent mb-3" size={28} />
              <p className="font-heading font-semibold text-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default AboutSection;
