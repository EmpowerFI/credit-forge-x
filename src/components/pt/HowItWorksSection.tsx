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
    title: "Seu histórico se forma sozinho",
    desc: "Sem curso, sem formulário, sem prova. O histórico nasce do que você já faz — o que vende, com que regularidade, como organiza o dinheiro que entra e sai.",
  },
  {
    icon: Sparkles,
    title: "A EmpowerFI mede o quanto o negócio está preparado",
    desc: "Atividade, regularidade, organização do dinheiro, evolução. Dessa leitura sai o que já está pronto e o que ainda falta — e o que falta vem escrito, não fica subentendido.",
  },
  {
    icon: Banknote,
    title: "O capital chega em reais, no Pix",
    desc: "Quando o crédito produtivo estiver disponível, ele chega na sua conta em reais, como qualquer outro recebimento — e quem aprova é a instituição financeira parceira, não o aplicativo. Você não precisa saber nada de blockchain: essa parte é problema nosso.",
  },
];

/* A distinção que o modelo inteiro existe para preservar: preparo, elegibilidade
   e aprovação são três coisas diferentes, e a última não é nossa. Sem esta nota a
   seção lê como esteira automática para o crédito. */
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
  </div>
);

const HowItWorksSection = () => (
  <section id="como-funciona" className="section-padding">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Como funciona"
        title="Como funciona"
        accent="para você"
        subtitle="Quatro passos, e nenhum deles exige que você pare de tocar o negócio para preencher alguma coisa."
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
