import { Activity, Percent, Bot } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Análise inteligente do seu negócio",
    desc: "Conectamos seu Open Finance e analisamos seu fluxo de caixa real. Sua maquininha, seu Pix, sua história. Isso conta mais que score do Serasa.",
  },
  {
    icon: Percent,
    title: "Taxa que faz sentido",
    desc: "Spread baixo financiado por capital de investidores via tecnologia blockchain. Você paga muito menos que cheque especial ou cartão rotativo, sem perder em qualidade de produto.",
  },
  {
    icon: Bot,
    title: "Mais que empréstimo, um copiloto",
    desc: "IA assistente que diagnostica seu negócio, sugere ações priorizadas e ajuda você a renegociar dívidas, organizar finanças e crescer. Em microsessões que cabem na sua rotina.",
  },
];

const SolutionSection = () => (
  <section id="solucao" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">A Solução</p>
        <h2 className="section-title">
          Crédito honesto, com{" "}
          <span className="text-gradient">tecnologia que entende você</span>
        </h2>
        <p className="section-subtitle">
          Três coisas que mudam a forma como você acessa capital — sem promessas vazias.
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
