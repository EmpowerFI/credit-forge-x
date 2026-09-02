import { ShoppingBag, Gauge, Coins, Bot } from "lucide-react";

const layers = [
  {
    icon: ShoppingBag,
    tag: "No ar agora",
    tagLive: true,
    title: "Marketplace",
    desc: "Conecta microempreendedoras a novos clientes e umas às outras. Gera atividade econômica real — vendas, recebimentos, reputação — e os dados que alimentam tudo o que vem depois.",
  },
  {
    icon: Gauge,
    tag: "Próximo passo",
    title: "Score alternativo invisível",
    desc: "Construído a partir do que ela já faz: os pagamentos que recebe, a atividade no marketplace, a disciplina financeira ao longo do tempo. Sem cursos, sem formulários, sem atrito — o histórico se forma sozinho, conforme ela empreende.",
  },
  {
    icon: Coins,
    tag: "Em sequência",
    title: "Crédito produtivo",
    desc: "Capital global chega em stablecoin, liquida na Solana e vira crédito produtivo em moeda local — valores pequenos, para estoque, equipamento ou capital de giro. Cada operação e cada pagamento geram registro auditável, sem expor a identidade da empreendedora.",
  },
  {
    icon: Bot,
    tag: "Em sequência",
    title: "Copiloto de IA",
    desc: "Orientação contextual no dia a dia do negócio: organizar finanças, priorizar decisões, entender o próximo passo. A IA sugere — a pessoa sempre decide.",
  },
];

const HowItWorksSection = () => (
  <section id="como-funciona" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Como funciona</p>
        <h2 className="section-title">
          Quatro camadas que se constroem{" "}
          <span className="text-gradient">uma sobre a outra</span>
        </h2>
        <p className="section-subtitle">
          O marketplace lança primeiro e gera os dados. As demais camadas vêm em sequência, sobre essa base.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {layers.map(({ icon: Icon, tag, tagLive, title, desc }, i) => (
          <div key={title} className="relative glass rounded-xl p-6 glow-border hover:shadow-glow transition-shadow duration-300">
            <span className="text-xs font-mono text-accent">0{i + 1}</span>
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center my-4">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium mb-3 ${tagLive ? "glow-border text-accent" : "bg-muted text-muted-foreground"}`}>
              {tagLive && <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />}
              {tag}
            </span>
            <h3 className="font-heading font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
