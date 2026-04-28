import { Link2, Gauge, Coins, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "1. Conexão via Open Finance",
    desc: "Em poucos cliques, você autoriza o acesso aos dados do seu negócio: maquininha, Pix, conta. Tudo regulado pelo Banco Central.",
  },
  {
    icon: Gauge,
    title: "2. Score baseado em comportamento",
    desc: "Nossa IA lê seu fluxo de caixa real e calcula um score próprio. Não dependemos do Serasa para entender quem é boa pagadora.",
  },
  {
    icon: Coins,
    title: "3. Capital tokenizado com lastro em Tesouro",
    desc: "O dinheiro vem de investidores via uma estrutura blockchain com lastro em títulos do Tesouro brasileiro. Isso derruba o custo do crédito.",
  },
  {
    icon: Sparkles,
    title: "4. Copiloto com IA assistente",
    desc: "Você recebe diagnóstico do negócio, sugestões priorizadas e ajuda para renegociar dívidas e organizar finanças.",
  },
];

const HowItWorksSection = () => (
  <section id="como-funciona" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Como funciona</p>
        <h2 className="section-title">
          Tecnologia avançada,{" "}
          <span className="text-gradient">explicada de forma simples</span>
        </h2>
        <p className="section-subtitle">
          Quatro pilares técnicos, sem jargão pesado.
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
