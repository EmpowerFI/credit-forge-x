import { Award, Building2, ExternalLink, Smartphone } from "lucide-react";
import { PLAY_STORE_URL } from "@/config/links";
import SectionHeading from "@/components/SectionHeading";
import SupportLogo from "@/components/SupportLogo";

interface TractionLogo {
  src: string;
  alt: string;
  label: string;
}

const items: {
  icon: typeof Smartphone;
  title: string;
  desc: string;
  href?: string;
  linkLabel?: string;
  logo?: TractionLogo;
}[] = [
  {
    icon: Smartphone,
    title: "O app está no ar",
    desc: "Publicado na Google Play e funcionando. Não é demonstração: dá para baixar e usar hoje.",
    href: PLAY_STORE_URL,
    linkLabel: "Ver na Google Play",
  },
  {
    icon: Award,
    title: "Construído e refinado com o Sebrae",
    desc: "Tese validada em campo junto ao Sebrae, uma das principais referências de inovação do país. A EmpowerFI concluiu o Ginga Prototipa, que resultou no protótipo em funcionamento, e está agora no PIER — programa do Sebrae para refinar o modelo de negócios com consultoria especializada.",
    logo: { src: "/sebrae.svg", alt: "Sebrae", label: "Apoio institucional" },
  },
  {
    icon: Building2,
    title: "Empresa brasileira, de verdade",
    desc: "Companhia constituída em São Paulo, com time, produto e operação no Brasil. Construímos para o contexto que conhecemos de perto.",
  },
];

const TractionSection = () => (
  <section id="tracao" className="section-padding gradient-subtle">
    <div className="container mx-auto space-y-12">
      <SectionHeading
        eyebrow="Confiança"
        title="O que já é"
        accent="real e verificável"
        subtitle="Sem número inflado e sem promessa. O que está aqui pode ser conferido hoje."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {items.map(({ icon: Icon, title, desc, href, linkLabel, logo }) => (
          <div key={title} className="flex flex-col rounded-2xl p-8 glass glow-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
              <Icon className="text-primary-foreground" size={24} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
            <p className="flex-1 leading-relaxed text-muted-foreground">{desc}</p>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-foreground"
              >
                {linkLabel} <ExternalLink size={14} />
              </a>
            )}
            {logo && <SupportLogo {...logo} />}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TractionSection;
