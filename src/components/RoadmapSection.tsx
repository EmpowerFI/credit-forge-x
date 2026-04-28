import { CheckCircle2 } from "lucide-react";

const current = [
  "Tese validada com pesquisa primária (entrevistas com empreendedoras via Sebrae)",
  "Acelerada pelo Sebrae — Programa Ginga Prototipa",
  "Protótipo navegável testado com beta-testers",
  "Aprofundamento técnico em arquitetura blockchain (Solana, RWA)",
  "Construção de rede com investidores e parceiros institucionais",
];

const phases = [
  { phase: "Fase 1", horizon: "Próximos 6 meses", title: "MVP técnico e validação", desc: "Hackathon Solana, MVP técnico do score e do copiloto, validação técnica da arquitetura tokenizada." },
  { phase: "Fase 2", horizon: "6–12 meses", title: "Pré-seed e primeira emissão", desc: "Captação pré-seed, parceria com tokenizadora, primeira emissão tokenizada com lastro em Tesouro." },
  { phase: "Fase 3", horizon: "12–24 meses", title: "Originação de crédito real", desc: "Operação real de originação, primeiros clientes, métricas iniciais de inadimplência e unit economics." },
  { phase: "Fase 4", horizon: "24+ meses", title: "Escala e internalização", desc: "Escala da base, expansão de produto e internalização da camada de tokenização." },
];

const RoadmapSection = () => (
  <section id="roadmap" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Roadmap</p>
        <h2 className="section-title">Construção <span className="text-gradient">por etapas</span></h2>
      </div>

      <div className="glass rounded-2xl p-8 glow-border shadow-glow max-w-3xl mx-auto space-y-5">
        <p className="text-sm font-medium text-accent uppercase tracking-widest text-center">Onde estamos hoje</p>
        <ul className="space-y-3">
          {current.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <CheckCircle2 className="text-accent shrink-0 mt-0.5" size={20} />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center pt-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Próximas fases</p>
      </div>

      <div className="relative">
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-accent/30 to-transparent" />
        <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-8">
          {phases.map(({ phase, horizon, title, desc }, i) => (
            <div key={phase} className={`${i % 2 === 1 ? "md:mt-16" : ""}`}>
              <div className="glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-accent">{phase}</span>
                  <span className="text-xs font-mono text-muted-foreground">{horizon}</span>
                </div>
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
