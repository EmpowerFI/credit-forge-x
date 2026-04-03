import { ArrowUpRight } from "lucide-react";

const news = [
  {
    tag: "Aceleração",
    title: "EmpowerFI selecionada para o programa Ginga Prototipa do Sebrae",
    desc: "A startup foi escolhida entre centenas de projetos para integrar o programa de aceleração focado em inovação e impacto social.",
    date: "Mar 2025",
  },
  {
    tag: "Tecnologia",
    title: "Novo modelo de crédito baseado em IA e dados comportamentais",
    desc: "A EmpowerFI está desenvolvendo um sistema proprietário que combina inteligência artificial e Open Finance para revolucionar a análise de risco.",
    date: "Fev 2025",
  },
  {
    tag: "Opinião",
    title: "Por que o sistema financeiro tradicional falha com empreendedoras",
    desc: "Uma análise profunda sobre as falhas estruturais que excluem milhões de mulheres do acesso ao crédito formal.",
    date: "Jan 2025",
  },
];

const NewsSection = () => (
  <section id="noticias" className="section-padding">
    <div className="container mx-auto space-y-12">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Notícias</p>
        <h2 className="section-title">Atualizações da <span className="text-gradient">EmpowerFI</span></h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {news.map(({ tag, title, desc, date }) => (
          <article key={title} className="glass rounded-xl overflow-hidden glow-border group hover:shadow-glow transition-shadow duration-300">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-accent">{tag}</span>
                <span className="text-xs text-muted-foreground">{date}</span>
              </div>
              <h3 className="font-heading font-bold text-foreground leading-snug group-hover:text-accent transition-colors">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              <span className="inline-flex items-center gap-1 text-sm text-accent">
                Ler mais <ArrowUpRight size={14} />
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default NewsSection;
