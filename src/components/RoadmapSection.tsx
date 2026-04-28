const phases = [
  { phase: "Fase 1", title: "Copiloto financeiro com IA", desc: "Diagnóstico do negócio via Open Finance e plano de ação personalizado em microsessões." },
  { phase: "Fase 2", title: "Score proprietário", desc: "Modelo de risco baseado em fluxo de caixa real, comportamento e histórico transacional." },
  { phase: "Fase 3", title: "Originação com capital tokenizado", desc: "Crédito originado com lastro em Tesouro brasileiro, mantendo taxa competitiva." },
  { phase: "Fase 4", title: "Marketplace e expansão", desc: "Produtos adjacentes (conta, recebíveis, seguros) e expansão para outros mercados." },
];

const RoadmapSection = () => (
  <section id="roadmap" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Roadmap</p>
        <h2 className="section-title">Construção <span className="text-gradient">por etapas</span></h2>
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
