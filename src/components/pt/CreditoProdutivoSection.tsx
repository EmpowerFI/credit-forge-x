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

      {/* O crédito ainda não existe como produto. A seção inteira lê como oferta
          sem este bloco. Ele separa as fases: no piloto, o capital e a decisão são
          da instituição financeira parceira; o modelo P2P vem depois, "sob a
          estrutura regulada aplicável" — sem afirmar licença nem autorização alguma. */}
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card/60 p-8 md:p-10">
        <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-accent glow-border">
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />
          Em desenvolvimento
        </span>
        <p className="leading-relaxed text-foreground">
          O crédito produtivo é a próxima etapa da EmpowerFI e começa como piloto, com
          empreendedoras e comunidades parceiras no Brasil. No piloto, uma instituição
          financeira parceira regulada fornece o capital e aprova cada crédito, sob a licença e
          a política de crédito dela. Depois que o piloto se validar, o caminho é o modelo P2P:
          investidores financiam os pedidos qualificados, sob a estrutura regulada aplicável —
          hoje a EmpowerFI não tem essa licença.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Organizar o negócio no aplicativo já fortalece o seu histórico desde agora. Em
          qualquer fase, você recebe e paga em reais, por Pix. Estar preparada não garante
          aprovação: o uso do aplicativo não constitui oferta nem garantia de crédito.
        </p>
      </div>
    </div>
  </section>
);

export default CreditoProdutivoSection;
