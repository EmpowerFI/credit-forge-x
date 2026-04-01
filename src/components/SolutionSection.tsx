import { Activity, BarChart3, Brain, Globe } from "lucide-react";

const features = [
  { icon: BarChart3, title: "Score Dinâmico", desc: "Baseado em fluxo de caixa e comportamento real, não histórico estático." },
  { icon: Activity, title: "Reputação Real", desc: "Construída por transações reais e dados on-chain verificáveis." },
  { icon: Brain, title: "IA em Tempo Real", desc: "Inteligência artificial analisando risco continuamente." },
  { icon: Globe, title: "Infraestrutura Global", desc: "Sem fronteiras. Crédito baseado em dados vivos." },
];

const SolutionSection = () => (
  <section id="solucao" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">A Solução</p>
        <h2 className="section-title">Reconstruindo o <span className="text-gradient">sistema de crédito</span></h2>
        <p className="section-subtitle">
          Um modelo baseado em comportamento real. Crédito baseado em dados vivos, não em histórico estático.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-8 glow-border hover:shadow-glow transition-all duration-300 group">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 group-hover:animate-float">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SolutionSection;
