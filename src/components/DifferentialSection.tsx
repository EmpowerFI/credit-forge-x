import { Database, Cpu, BarChart, Landmark } from "lucide-react";

const stack = [
  { icon: Database, label: "Geração de Dados" },
  { icon: Cpu, label: "Modelagem de Risco" },
  { icon: BarChart, label: "Score Proprietário" },
  { icon: Landmark, label: "Infraestrutura de Crédito" },
];

const DifferentialSection = () => (
  <section className="section-padding gradient-subtle">
    <div className="container mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <p className="text-sm font-medium text-accent uppercase tracking-widest">Diferencial</p>
          <h2 className="section-title">
            Não é apenas uma fintech. É uma <span className="text-gradient">nova camada de risco</span> para o sistema financeiro global.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            A EmpowerFI controla toda a stack: geração de dados, modelagem de risco, score proprietário e 
            infraestrutura de crédito. Quanto mais o usuário utiliza, mais inteligente e preciso o sistema se torna.
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
