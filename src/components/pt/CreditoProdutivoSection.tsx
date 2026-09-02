import { Boxes, Wallet, Wrench } from "lucide-react";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";

const uses = [
  {
    icon: Boxes,
    title: "Estoque",
    desc: "Comprar mais barato, comprar na hora certa, não perder venda por falta de produto.",
  },
  {
    icon: Wrench,
    title: "Equipamento",
    desc: "A máquina, a ferramenta ou o equipamento que aumenta o que você consegue produzir e entregar.",
  },
  {
    icon: Wallet,
    title: "Capital de giro",
    desc: "O fôlego para atravessar o mês, pagar fornecedor e aceitar um pedido maior sem apertar o caixa.",
  },
];

const cycle = [
  { label: "Crédito produtivo", emphasis: true },
  { label: "Estoque · Equipamento · Capital de giro" },
  { label: "Mais faturamento", emphasis: true },
  { label: "Você paga de volta" },
];

const CreditoProdutivoSection = () => (
  <section id="credito-produtivo" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Crédito produtivo"
        title="Crédito que entra no negócio e"
        accent="volta como faturamento."
        subtitle="É diferente de crédito para tapar buraco. Cheque especial e rotativo custam caro e não deixam nada para trás. Crédito produtivo compra alguma coisa que faz o negócio render mais."
      />

      <CapitalFlow
        steps={cycle}
        loopLabel="Pago de volta, o capital pode financiar o próximo negócio."
        caption="O crédito produtivo vira estoque, equipamento ou capital de giro, gera mais faturamento e é pago de volta."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {uses.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      {/* Ainda não há crédito disponível. Dizer isso com todas as letras é o que
          impede a página de virar promessa. */}
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/60 p-8 text-center">
        <p className="leading-relaxed text-foreground">
          <span className="font-medium">Ainda não estamos emprestando.</span> O primeiro
          piloto de microcrédito produtivo está em preparação, com empreendedoras e
          comunidades parceiras no Brasil.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Quem já usa o app e mantém o negócio organizado chega na frente quando o piloto
          abrir — mas usar o app não garante crédito, e a gente não vai fingir que garante.
        </p>
      </div>
    </div>
  </section>
);

export default CreditoProdutivoSection;
