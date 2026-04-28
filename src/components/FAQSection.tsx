import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Como vocês definem minha taxa?",
    a: "Sua taxa parte de 2% ao mês e é calculada com base no comportamento real do seu negócio: fluxo de caixa, recorrência de receita, sazonalidade e histórico transacional via Open Finance. Quem opera bem paga menos — sem depender do Serasa.",
  },
  {
    q: "É seguro conectar o Open Finance?",
    a: "Sim. O Open Finance é regulado pelo Banco Central e usa criptografia ponta a ponta. Você autoriza apenas a leitura dos dados que já são seus, e pode revogar o acesso quando quiser. A gente nunca movimenta dinheiro sem sua autorização explícita.",
  },
  {
    q: "Quanto tempo até eu receber o crédito?",
    a: "A análise leva minutos. Aprovado o crédito, o valor é liberado no mesmo dia útil em conta de sua escolha. Sem fila de agência, sem gerente, sem papel.",
  },
  {
    q: "E se eu já estiver com nome sujo?",
    a: "Restrição no Serasa não é um 'não' automático aqui. Avaliamos seu negócio hoje, não o seu passado. Se o fluxo de caixa mostra capacidade de pagamento, conseguimos oferecer crédito — e ainda ajudamos você a renegociar dívidas com o copiloto de IA.",
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
