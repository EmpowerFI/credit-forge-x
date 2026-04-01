const phases = [
  { phase: "Fase 1", title: "Assistente Financeiro com IA", desc: "Integrado ao Open Finance para análise inteligente de fluxo de caixa." },
  { phase: "Fase 2", title: "Score Proprietário", desc: "Desenvolvimento do modelo de score baseado em comportamento real." },
  { phase: "Fase 3", title: "Crédito com Pools de Liquidez", desc: "Oferta de crédito utilizando pools de liquidez descentralizados." },
  { phase: "Fase 4", title: "Marketplace & Escala Global", desc: "Expansão para marketplace financeiro e internacionalização." },
];

const RoadmapSection = () => (
  <section id="roadmap" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Roadmap</p>
        <h2 className="section-title">Evolução <span className="text-gradient">estratégica</span></h2>
      </div>

      <div className="relative">
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-accent/30 to-transparent" />
        <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-8">
          {phases.map(({ phase, title, desc }, i) => (
            <div key={phase} className={`${i % 2 === 1 ? "md:mt-16" : ""}`}>
              <div className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
                <span className="text-xs font-mono text-accent">{phase}</span>
                <h3 className="text-lg font-heading font-bold text-foreground mt-1">{title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default RoadmapSection;
