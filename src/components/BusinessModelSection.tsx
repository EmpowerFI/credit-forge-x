import { Percent, ArrowLeftRight, Building2, Code2 } from "lucide-react";

const models = [
  { icon: Percent, title: "Juros sobre empréstimos", desc: "Receita principal através de operações de crédito." },
  { icon: ArrowLeftRight, title: "Taxas de transação", desc: "Fee sobre cada transação processada na plataforma." },
  { icon: Building2, title: "Serviços financeiros B2B", desc: "Soluções de risco e score para empresas parceiras." },
  { icon: Code2, title: "APIs para parceiros", desc: "Infraestrutura de crédito como serviço (CaaS)." },
];

const BusinessModelSection = () => (
  <section className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Modelo de Negócio</p>
        <h2 className="section-title">Receita <span className="text-gradient">diversificada</span></h2>
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
