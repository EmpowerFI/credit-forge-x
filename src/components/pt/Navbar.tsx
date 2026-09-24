import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";

// Os itens marcados com `top` aparecem também na fileira do desktop; os demais
// ficam no painel. A fileira mostra o caminho da história — o problema, como
// funciona, capital, auditabilidade — e não a lista inteira do site.
const navLinks: HeaderLink[] = [
  { label: "Para quem é", to: "/pt#who", top: true },
  { label: "O problema", to: "/pt#problem", top: true },
  { label: "Como funciona", to: "/pt#how-it-works", top: true },
  { label: "Modelo de negócio", to: "/pt#business-model" },
  { label: "Capital", to: "/pt#capital", top: true },
  { label: "Auditabilidade", to: "/pt#auditability" },
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
    other={{ label: "EN · PT", panelLabel: "English", to: "/" }}
    primary={{ label: "Seja parceiro", to: "/pt#contact" }}
    appLabel="App · Devnet"
    menuLabel="Menu"
  />
);

export default Navbar;
