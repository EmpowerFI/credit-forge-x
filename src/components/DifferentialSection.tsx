import { Network, Gauge, ShieldCheck } from "lucide-react";

const intersection = [
  "Marketplace de MEIs",
  "Score alternativo invisível",
  "Capital RWA on-chain",
  "IA contextual",
  "Jornada evolutiva",
];

const moats = [
  {
    icon: Gauge,
    title: "Score que se forma sozinho",
    desc: "Sem cursos, sem formulários, sem atrito. O histórico financeiro nasce do comportamento de poupança e da atividade no marketplace — não de um cadastro que a empreendedora precisa parar para preencher.",
  },
  {
    icon: ShieldCheck,
    title: "Prova de impacto contínua, não relatório anual",
    desc: "Em vez de ESG autodeclarado uma vez por ano, cada alocação e cada resultado ficam registrados na blockchain. O impacto é verificável em tempo real — não uma promessa em PDF.",
  },
];

const DifferentialSection = () => (
  <section id="diferencial" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Por que é diferente</p>
        <h2 className="section-title">
          O único player no{" "}
          <span className="text-gradient">cruzamento dessas cinco camadas</span>
        </h2>
        <p className="section-subtitle">
          Cada peça existe isolada no mercado. O fosso está em juntar todas — e fazer cada uma reforçar a seguinte.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {intersection.map((item, i) => (
          <div key={item} className="flex items-center gap-3">
            <span className="glass rounded-full px-5 py-2.5 glow-border font-heading font-semibold text-foreground text-sm">
              {item}
            </span>
            {i < intersection.length - 1 && (
              <Network className="text-accent hidden sm:block" size={16} />
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {moats.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass rounded-2xl p-8 glow-border text-left">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default DifferentialSection;
