import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Em que estágio o produto está hoje?",
    a: "Estamos em fase de desenvolvimento e validação. Tese validada com pesquisa primária, protótipo navegável testado, acelerada pelo Sebrae. Próxima etapa é MVP técnico via hackathon Solana e captação pré-seed. Originação real de crédito está prevista para 12–18 meses, após estruturação regulatória adequada.",
  },
  {
    q: "Como vão captar e originar crédito?",
    a: "Capital virá de investidores via estrutura tokenizada com lastro em Tesouro brasileiro (similar ao modelo da Ondo Finance, adaptado ao contexto brasileiro). Originação inicial via parceria com instituições reguladas; visão de longo prazo é internalização.",
  },
  {
    q: "Qual o caminho regulatório?",
    a: "Estamos mapeando estrutura adequada com escritório especializado. Caminho provável envolve correspondente bancário ou SCD própria, em paralelo a estrutura de tokenização via securitizadora parceira.",
  },
  {
    q: "Quem é o time?",
    a: "Daniele Rodrigues dos Santos (fundadora) — engenheira da computação com 20 anos de experiência em TI corporativa. Cofundador técnico em blockchain e mercado de capitais é prioridade da próxima fase.",
  },
  {
    q: "Como posso me envolver?",
    a: "Investidores: agende uma conversa pelo formulário. Programas de aceleração: estamos abertos a participar. Parceiros institucionais (tokenizadoras, IMFs, bancos de desenvolvimento): adoraríamos conversar. Talentos com experiência em fintech ou Web3: estamos formando time fundador.",
  },
];

const FAQSection = () => (
  <section id="faq" className="section-padding gradient-subtle">
    <div className="container mx-auto max-w-3xl space-y-10">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-accent uppercase tracking-widest">Perguntas frequentes</p>
        <h2 className="section-title">
          Direto ao <span className="text-gradient">ponto</span>
        </h2>
      </div>

      <Accordion type="single" collapsible className="glass rounded-xl glow-border px-6">
        {faqs.map((item, i) => (
          <AccordionItem key={item.q} value={`item-${i}`} className="border-border">
            <AccordionTrigger className="text-left font-heading text-foreground hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQSection;
