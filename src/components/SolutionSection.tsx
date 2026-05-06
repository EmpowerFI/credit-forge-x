import { Activity, Percent, Bot } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Análise inteligente do negócio",
    desc: "Vamos conectar via Open Finance e analisar fluxo de caixa real — maquininha, Pix, conta. Comportamento transacional conta mais que score do Serasa.",
  },
  {
    icon: Percent,
    title: "Taxa que faz sentido",
    desc: "Modelo projetado para taxas significativamente abaixo das praticadas hoje pelo cheque especial e cartão rotativo, viabilizado por capital tokenizado.",
  },
  {
    icon: Bot,
    title: "Mais que empréstimo, um copiloto",
    desc: "Empreendedoras receberão diagnóstico do negócio via IA, sugestões priorizadas e suporte para renegociar dívidas e organizar finanças. Em microsessões adaptativas.",
  },
];

const SolutionSection = () => (
  <section id="solucao" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">A Solução</p>
        <h2 className="section-title">
          Nossa <span className="text-gradient">tese técnica</span>
        </h2>
        <p className="section-subtitle">
          Quatro pilares que estão sendo construídos para resolver o problema acima.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
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
