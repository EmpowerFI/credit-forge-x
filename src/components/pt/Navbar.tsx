import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";

// `top: "lg"` são os três que cabem na barra de um notebook de 1024px; os
// marcados "xl" entram quando há espaço; o resto fica no painel. A fileira
// mostra o caminho da história, não a lista inteira do site.
const navLinks: HeaderLink[] = [
  { label: "Como funciona", to: "/pt#how-it-works", top: "lg" },
  { label: "Rede de capital", to: "/pt#capital-network", top: "lg" },
  { label: "Economias locais", to: "/pt#local-economies", top: "lg" },
  { label: "Motores de capital", to: "/pt#engines" },
  { label: "Para quem é", to: "/pt#who" },
  { label: "O problema", to: "/pt#problem" },
  { label: "Capital local primeiro", to: "/pt#local-first" },
  { label: "Capital global", to: "/pt#global-capital" },
  { label: "Economias locais investíveis", to: "/pt#north-star" },
  { label: "Modelo de negócio", to: "/pt#business-model" },
  { label: "Tecnologia", to: "/pt#technology" },
  { label: "Auditabilidade", to: "/pt#auditability" },
  { label: "Para provedores de capital", to: "/pt/investidores" },
  { label: "Para empreendedoras", to: "/pt/empreendedoras" },
  { label: "Evidências e fontes", to: "/sources" },
  { label: "Sobre", to: "/pt/sobre" },
  { label: "Contato", to: "/pt#contact" },
];

const Navbar = () => (
  <SiteHeader
    home="/pt"
    lang="pt"
    links={navLinks}
    language={{ current: "PT", other: "EN", otherName: "English", to: "/" }}
    primary={{ label: "Seja parceiro", to: "/pt#contact" }}
    appLabel="App · Devnet"
    menuLabel="Menu"
  />
);

export default Navbar;
