import { Link2, Gauge, Coins, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "1. Conexão via Open Finance",
    desc: "A empreendedora autorizará o acesso a dados do negócio (maquininha, Pix, conta) em poucos cliques, dentro do framework regulado pelo Banco Central.",
  },
  {
    icon: Gauge,
    title: "2. Score baseado em comportamento",
    desc: "Nosso modelo lerá fluxo de caixa real e calculará score próprio. A arquitetura não depende do Serasa para identificar boas pagadoras.",
  },
  {
    icon: Coins,
    title: "3. Capital tokenizado",
    desc: "O funding virá de investidores via estrutura tokenizada  — desenhado para reduzir substancialmente o custo do crédito.",
  },
  {
    icon: Sparkles,
    title: "4. Copiloto com IA assistente",
    desc: "A jornada incluirá diagnóstico do negócio, sugestões priorizadas e apoio para renegociação de dívidas e organização financeira.",
  },
];

const HowItWorksSection = () => (
  <section id="como-funciona" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Como vai funcionar</p>
        <h2 className="section-title">
          Quatro pilares técnicos da{" "}
          <span className="text-gradient">nossa arquitetura</span>
        </h2>
        <p className="section-subtitle">
          Sem jargão pesado.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="font-heading font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
