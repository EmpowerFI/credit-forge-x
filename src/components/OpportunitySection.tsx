const stats = [
  { value: "$8T+", label: "Mercado global de crédito" },
  { value: "$5T", label: "Gap de crédito para PMEs" },
  { value: "2,3M+", label: "Empresas lideradas por mulheres no Brasil" },
  { value: "∞", label: "Potencial com Open Finance + Blockchain" },
];

const OpportunitySection = () => (
  <section id="oportunidade" className="section-padding">
    <div className="container mx-auto text-center space-y-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Oportunidade</p>
        <h2 className="section-title">Mercado <span className="text-gradient">massivo e ineficiente</span></h2>
        <p className="section-subtitle">
          A solução nasce global, começando pelo Brasil como mercado MVP.
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
