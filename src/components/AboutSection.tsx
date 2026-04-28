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
            <span className="text-gradient">construída com tecnologia de ponta</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            A EmpowerFI é um produto de crédito desenhado para quem o banco tradicional não enxerga: empreendedoras com renda variável, sem garantias formais, com jornada dupla e tempo escasso.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Combinamos Open Finance, IA e capital tokenizado com lastro em Tesouro brasileiro para entregar uma taxa que cabe no seu negócio — e uma decisão em minutos, sem letra miúda.
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
