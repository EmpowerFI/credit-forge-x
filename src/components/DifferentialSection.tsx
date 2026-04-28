import { Database, Cpu, BarChart, Landmark } from "lucide-react";

const stack = [
  { icon: Database, label: "Dados via Open Finance" },
  { icon: Cpu, label: "Modelagem de risco com IA" },
  { icon: BarChart, label: "Score proprietário" },
  { icon: Landmark, label: "Capital tokenizado com lastro em Tesouro" },
];

const DifferentialSection = () => (
  <section className="section-padding gradient-subtle">
    <div className="container mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">Diferencial</p>
          <h2 className="section-title">
            Controle total da{" "}
            <span className="text-gradient">stack de crédito</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            A EmpowerFI é dona de cada camada: coleta de dados, modelagem de risco, score proprietário e originação. Quanto mais você usa, mais preciso fica o sistema — e mais justa fica sua taxa.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Construído pensando em quem o sistema bancário historicamente não enxerga: empreendedoras com renda variável, sem garantias formais, com jornada dupla e tempo escasso.
          </p>
        </div>

        <div className="space-y-4">
          {stack.map(({ icon: Icon, label }, i) => (
            <div key={label} className="flex items-center gap-4 glass rounded-xl p-5 glow-border">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Icon className="text-primary-foreground" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-heading font-semibold text-foreground">{label}</p>
              </div>
              <span className="text-xs text-accent font-mono">0{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default DifferentialSection;
