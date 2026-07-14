import { Scale, Eye } from "lucide-react";

const stats = [
  { value: "29%", label: "do crédito empresarial vai para mulheres — que tocam ~40% das operações" },
  { value: "68%", label: "das empreendedoras têm pedidos de crédito negados ou só parcialmente atendidos" },
  { value: "7,1%", label: "de inadimplência entre as mulheres, contra 7,6% entre os homens — elas pagam melhor e ainda assim pagam juros mais altos" },
];

const failures = [
  {
    icon: Scale,
    title: "O crédito ignora quem sustenta a economia",
    desc: "Mulheres tocam cerca de 40% das operações, mas recebem só ~29% do crédito empresarial — e, mesmo inadimplindo menos que os homens, pagam juros mais altos. Sem histórico bancário formal, ficam invisíveis aos modelos de risco.",
  },
  {
    icon: Eye,
    title: "O capital de impacto não enxerga onde chega",
    desc: "Fundos de impacto não têm prova verificável e em tempo real de onde o dinheiro foi parar. A medição é anual, autodeclarada e difícil de auditar — o que trava a alocação séria de capital.",
  },
];

const ProblemSection = () => (
  <section id="problema" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">O Problema</p>
        <h2 className="section-title">
          Duas falhas de mercado,{" "}
          <span className="text-gradient">uma só infraestrutura para resolver</span>
        </h2>
        <p className="section-subtitle">
          Um lado não consegue provar que merece crédito. O outro não consegue provar onde o capital gera impacto.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-6">
          {stats.map(({ value, label }) => (
            <div key={label} className="glass rounded-xl p-8 glow-border text-center">
              <p className="text-4xl md:text-5xl font-heading font-bold text-gradient mb-2">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">Fonte: Sebrae e Banco Central, 2024.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {failures.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-2xl p-8 glow-border text-left">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
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

export default ProblemSection;
