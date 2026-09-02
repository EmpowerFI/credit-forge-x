import { Eye, Receipt, TrendingDown } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

const stats = [
  { value: "29%", label: "do crédito empresarial vai para mulheres — que tocam ~40% das operações" },
  { value: "68%", label: "das empreendedoras têm pedidos de crédito negados ou só parcialmente atendidos" },
  { value: "7,1%", label: "de inadimplência entre as mulheres, contra 7,6% entre os homens — elas pagam melhor e ainda assim pagam juros mais altos" },
];

const failures = [
  {
    icon: Eye,
    title: "O que você faz não vira histórico",
    desc: "Venda no Pix, na maquininha, no dinheiro. Você vende, recebe e paga em dia — e nada disso chega ao banco. Do lado de lá, um negócio que sustenta uma família inteira simplesmente não aparece.",
  },
  {
    icon: Receipt,
    title: "Sem histórico, o modelo nem te avalia",
    desc: "Sem conta empresarial, garantia formal ou balanço auditado, o modelo de risco não tem onde olhar. Você não é recusada por ser má pagadora — é recusada por não existir para o modelo.",
  },
  {
    icon: TrendingDown,
    title: "E o negócio fica preso no tamanho de hoje",
    desc: "Sem capital de giro não dá para comprar estoque, contratar nem atravessar um mês ruim. O negócio não para porque falhou: para porque faltou combustível para crescer.",
  },
];

const ProblemSection = () => (
  <section id="problema" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="O problema"
        title="O problema nunca foi o seu negócio."
        accent="Foi o que o banco consegue enxergar."
        subtitle="Não é falta de capacidade nem de disciplina. É uma falha de infraestrutura de dados — e ela se repete todo dia."
      />

      <div className="space-y-4">
        <div className="grid gap-6 sm:grid-cols-3">
          {stats.map(({ value, label }) => (
            <div key={label} className="rounded-xl p-8 text-center glass glow-border">
              <p className="mb-2 font-heading text-4xl font-bold text-gradient md:text-5xl">
                {value}
              </p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Fonte: Sebrae e Banco Central, 2024.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {failures.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl p-8 text-left glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ProblemSection;
