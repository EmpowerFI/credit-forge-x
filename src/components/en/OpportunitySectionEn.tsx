const stats = [
  { value: "7.4M+", label: "Microentrepreneurs invisible to traditional credit in Brazil" },
  { value: "R$ 1T", label: "Unmet SMB credit demand in the country" },
  { value: "350%+", label: "Average revolving card cost p.a. — what we intend to replace" },
  { value: "Projected model", label: "Rates substantially below the credit available today for this audience" },
];

const OpportunitySectionEn = () => (
  <section id="opportunity" className="section-padding">
    <div className="container mx-auto text-center space-y-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Opportunity</p>
        <h2 className="section-title">
          A market that is <span className="text-gradient">large, expensive and underserved</span>
        </h2>
        <p className="section-subtitle">
          The pain is concrete. The technology to solve it exists today.
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

export default OpportunitySectionEn;
