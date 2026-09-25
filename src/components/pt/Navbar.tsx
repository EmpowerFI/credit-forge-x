import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";

// `top: "lg"` são os três que cabem na barra de um notebook de 1024px; os
// marcados "xl" entram quando há espaço; o resto fica no painel. A fileira
// mostra o caminho da história, não a lista inteira do site.
const navLinks: HeaderLink[] = [
  { label: "Para quem é", to: "/pt#who", top: "lg" },
  { label: "Como funciona", to: "/pt#how-it-works", top: "lg" },
  { label: "Capital", to: "/pt#capital", top: "lg" },
  { label: "O problema", to: "/pt#problem", top: "xl" },
  { label: "Auditabilidade", to: "/pt#auditability" },
  { label: "Modelo de negócio", to: "/pt#business-model" },
  { label: "Para empreendedoras", to: "/pt/empreendedoras" },
  { label: "Sobre", to: "/pt/sobre" },
  { label: "Investidores", to: "/pt/investidores" },
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
