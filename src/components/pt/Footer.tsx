import { CONTACT_EMAIL } from "@/config/links";
import SiteFooter, { type FooterColumn } from "@/components/site/SiteFooter";

const columns: FooterColumn[] = [
  {
    title: "Plataforma",
    links: [
      { label: "Como funciona", to: "/pt#how-it-works" },
      { label: "Motores de capital", to: "/pt#engines" },
      { label: "Rede de capital", to: "/pt#capital-network" },
      { label: "Economias locais", to: "/pt#local-economies" },
      { label: "Modelo de negócio", to: "/pt#business-model" },
      { label: "Auditabilidade", to: "/pt#auditability" },
    ],
  },
  {
    title: "Para",
    links: [
      { label: "Empreendedoras", to: "/pt/empreendedoras" },
      { label: "Provedores de capital", to: "/pt/investidores" },
      { label: "Investidores", to: "/pt/investidores#waitlist" },
      { label: "Patrocinadores", to: "/pt#who" },
      { label: "Comunidades", to: "/pt#who" },
      { label: "Programas locais", to: "/pt#who" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", to: "/pt/sobre" },
      { label: "Piloto", to: "/pt/investidores#pilot" },
      { label: "Evidências e fontes", to: "/sources" },
      { label: "Contato", to: "/pt#contact" },
      { label: "Termos", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
      { label: "E-mail", href: `mailto:${CONTACT_EMAIL}` },
      { label: "English", to: "/" },
    ],
  },
];

const Footer = () => (
  <SiteFooter
    home="/pt"
    tagline="Infraestrutura de capital conectando negócios produtivos ao capital local, doméstico e global. Capital global. Circulação local. Prosperidade mensurável."
    positioning="Infraestrutura de capital · Brasil primeiro · Global por desenho"
    columns={columns}
    notices={[
      "Nada neste site é oferta de valores mobiliários, de crédito ou de produto financeiro. A EmpowerFI não opera hoje negócio licenciado de crédito, P2P, investimento, câmbio ou moeda local. Entrar na lista de espera é manifestação de interesse, sem compromisso, e nenhum retorno é prometido ou sugerido.",
      "Investimentos, retornos, câmbio, conversão em moeda local e liquidação do protótipo são simulados onde explicitamente identificado; as transações em blockchain usam ativos de teste na Devnet da Solana. Funções financeiras reguladas futuras devem operar por estruturas e parceiros regulados adequados.",
    ]}
    rights="Todos os direitos reservados."
  />
);

export default Footer;
