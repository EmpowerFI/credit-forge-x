import { Banknote, Gauge, Smartphone, Sparkles } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

const steps = [
  {
    icon: Smartphone,
    title: "Você usa o app no dia a dia",
    desc: "Vendas, recebimentos e clientes no mesmo lugar onde você já trabalha. Organizar o negócio deixa de ser caderno e planilha e vira parte natural do dia.",
  },
  {
    icon: Gauge,
    title: "Seu histórico ganha forma mês a mês",
    desc: "O que você registra — o que vendeu, o que gastou, como ficou o caixa — vira, mês a mês, o histórico que o banco nunca teve. Se você participa de uma comunidade ou programa de empreendedorismo, a formação que ele oferece também ajuda.",
  },
  {
    icon: Sparkles,
    title: "A EmpowerFI mede o quanto o negócio está preparado",
    desc: "Atividade, regularidade, organização do dinheiro, evolução. Dessa leitura sai o que já está pronto e o que ainda falta — e o que falta vem escrito, não fica subentendido. Pedir crédito continua sendo escolha sua.",
  },
  {
    icon: Banknote,
    title: "O capital chega em reais, no Pix",
    desc: "Se você pedir crédito e o pedido for qualificado, o dinheiro chega na sua conta em reais, por Pix, como qualquer outro recebimento — e você paga de volta também por Pix.",
  },
];

/* A distinção que o modelo inteiro existe para preservar: preparo, elegibilidade
   e financiamento são três coisas diferentes. Quem fornece o capital e decide
   depende da fase — no piloto, a instituição financeira parceira; no modelo P2P,
   investidores financiam pedidos qualificados. Sem esta nota a seção lê como
   esteira automática para o crédito. */
const Nota = () => (
  <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card/60 p-8 text-center md:p-10">
    <p className="font-heading text-xl font-bold text-foreground">
      Estar preparada não é o mesmo que{" "}
      <span className="text-gradient">ter crédito aprovado.</span>
    </p>
    <p className="leading-relaxed text-muted-foreground">
      Preparo é uma etapa, não uma promessa. E crédito não é o objetivo para todo mundo: se
      o negócio ainda não precisa de capital, ou se pegar dívida agora não ajudaria, a
      resposta certa é esperar — e o aplicativo continua servindo para organizar o negócio
      do mesmo jeito.
    </p>
    <p className="leading-relaxed text-muted-foreground">
      De onde vem o capital depende da fase. No piloto, uma instituição financeira parceira
      regulada fornece o capital e aprova o crédito. Depois, no modelo P2P, investidores
      financiam os pedidos qualificados, e a EmpowerFI formaliza o empréstimo e acompanha os
      pagamentos. Nos dois casos, você recebe e paga em reais, por Pix. Cada etapa fica
      comprovada em blockchain, sem nenhum dado pessoal seu — é assim que a gente prova o que
      foi feito, e você não precisa lidar com nada disso.
    </p>
  </div>
);

const HowItWorksSection = () => (
  <section id="como-funciona" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Como funciona"
        title="Como funciona"
        accent="para você"
        subtitle="Quatro passos, pensados para caber na rotina de quem toca o negócio."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="relative rounded-xl p-6 transition-shadow duration-300 glass glow-border hover:shadow-glow"
          >
            <span className="font-mono text-xs text-accent">0{i + 1}</span>
            <div className="my-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={22} />
            </div>
            <h3 className="mb-2 font-heading font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <Nota />
    </div>
  </section>
);

export default HowItWorksSection;
