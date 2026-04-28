const stats = [
  { value: "2,3M+", label: "Microempreendedoras invisíveis ao crédito tradicional no Brasil" },
  { value: "R$ 1T", label: "Demanda reprimida de crédito para PMEs no país" },
  { value: "350%+", label: "Custo médio do cartão rotativo a.a. — o que pretendemos substituir" },
  { value: "Modelo projetado", label: "Taxas substancialmente abaixo do crédito disponível hoje para esse público" },
];

const OpportunitySection = () => (
  <section id="oportunidade" className="section-padding">
    <div className="container mx-auto text-center space-y-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Oportunidade</p>
        <h2 className="section-title">
          Mercado <span className="text-gradient">grande, caro e mal servido</span>
        </h2>
        <p className="section-subtitle">
          A dor é concreta. A tecnologia para resolver, hoje, existe.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ value, label }) => (
          <div key={label} className="glass rounded-xl p-8 glow-border text-center">
            <p className="text-3xl md:text-4xl font-heading font-bold text-gradient mb-2">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default OpportunitySection;
