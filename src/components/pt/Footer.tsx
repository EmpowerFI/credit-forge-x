import { CONTACT_EMAIL } from "@/config/links";
import SiteFooter, { type FooterColumn } from "@/components/site/SiteFooter";

const columns: FooterColumn[] = [
  {
    title: "Plataforma",
    links: [
      { label: "Para quem é", to: "/pt#who" },
      { label: "Como funciona", to: "/pt#how-it-works" },
      { label: "Modelo de negócio", to: "/pt#business-model" },
      { label: "Capital", to: "/pt#capital" },
      { label: "Auditabilidade", to: "/pt#auditability" },
    ],
  },
  {
    title: "Para",
    links: [
      { label: "Patrocinadores de programas", to: "/pt#who" },
      { label: "Empreendedoras", to: "/pt/empreendedoras" },
      { label: "Investidores", to: "/pt/investidores" },
      { label: "Contato", to: "/pt#contact" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", to: "/pt/sobre" },
      { label: "Evidências e fontes", to: "/sources" },
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
    tagline="Infraestrutura de crédito produtivo e inteligência de impacto: da execução de programas à evidência auditável e ao capital produtivo."
    positioning="RWA · Fintech de impacto · Brasil → LatAm"
    columns={columns}
    notices={[
      "Nada neste site é oferta de valores mobiliários ou de produto financeiro. Entrar na lista de espera é uma manifestação de interesse, sem compromisso. Nenhum retorno é prometido ou sugerido.",
      "Protótipo de uma futura arquitetura regulada de crédito produtivo P2P. Investimentos, retornos, câmbio e liquidação via Pix do hackathon são simulados; as transações em blockchain usam ativos de teste na Devnet.",
    ]}
    rights="Todos os direitos reservados."
  />
);

export default Footer;
