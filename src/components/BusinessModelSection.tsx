import { Percent, ArrowLeftRight, Building2, Code2 } from "lucide-react";

const models = [
  { icon: Percent, title: "Spread sobre crédito", desc: "Receita principal projetada da operação de empréstimos com taxa justa e risco ajustado." },
  { icon: ArrowLeftRight, title: "Taxas transacionais", desc: "Fee sobre operações financeiras processadas dentro da plataforma." },
  { icon: Building2, title: "Risco como serviço", desc: "Score e modelagem licenciados para parceiros B2B com público similar." },
  { icon: Code2, title: "APIs de crédito", desc: "Infraestrutura de originação plugável para outros players (CaaS)." },
];

const BusinessModelSection = () => (
  <section className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Modelo de Negócio</p>
        <h2 className="section-title">Nosso modelo projetado de <span className="text-gradient">receita diversificada</span></h2>
        <p className="section-subtitle">Quatro frentes de monetização desenhadas para escalar com a plataforma.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {models.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300 text-center">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-4">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="font-heading font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BusinessModelSection;
