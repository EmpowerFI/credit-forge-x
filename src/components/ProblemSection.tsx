import { AlertTriangle, XCircle, TrendingDown, Ban } from "lucide-react";

const problems = [
  { icon: Ban, text: "Renda variável não é considerada" },
  { icon: XCircle, text: "Sem histórico bancário formal, sem crédito" },
  { icon: TrendingDown, text: "Modelos de risco presos ao Serasa" },
  { icon: AlertTriangle, text: "Taxas abusivas para quem mais precisa" },
];

const ProblemSection = () => (
  <section id="problema" className="section-padding gradient-subtle">
    <div className="container mx-auto text-center space-y-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">O Problema</p>
        <h2 className="section-title">
          O banco analisa seu passado.{" "}
          <span className="text-gradient">Estamos construindo algo que analisa seu negócio.</span>
        </h2>
        <p className="section-subtitle">
          Microempreendedoras geram receita todos os dias e ainda assim recebem um "não" — ou uma taxa de cheque especial.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {problems.map(({ icon: Icon, text }) => (
          <div key={text} className="glass rounded-xl p-6 text-left glow-border">
            <Icon className="text-destructive mb-4" size={24} />
            <p className="text-foreground font-medium">{text}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-8 glow-border max-w-2xl mx-auto">
        <p className="text-xl md:text-2xl font-heading font-bold text-foreground">
          Boa pagadora tratada como{" "}
          <span className="text-gradient">alto risco.</span>{" "}
          É esse gap que estamos endereçando.
        </p>
      </div>
    </div>
  </section>
);

export default ProblemSection;
