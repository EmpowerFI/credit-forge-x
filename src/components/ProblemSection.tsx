import { AlertTriangle, XCircle, TrendingDown, Ban } from "lucide-react";

const problems = [
  { icon: Ban, text: "Renda informal não é considerada" },
  { icon: XCircle, text: "Falta de histórico bancário tradicional" },
  { icon: TrendingDown, text: "Modelos de risco desatualizados" },
  { icon: AlertTriangle, text: "Viés estrutural no sistema financeiro" },
];

const ProblemSection = () => (
  <section id="problema" className="section-padding gradient-subtle">
    <div className="container mx-auto text-center space-y-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">O Problema</p>
        <h2 className="section-title">O sistema financeiro <span className="text-gradient">não entende</span> a nova economia</h2>
        <p className="section-subtitle">
          Milhões de mulheres empreendedoras geram receita todos os dias, mas continuam invisíveis para o crédito.
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
          "Bons pagadores são tratados como <span className="text-gradient">alto risco.</span>"
        </p>
      </div>
    </div>
  </section>
);

export default ProblemSection;
