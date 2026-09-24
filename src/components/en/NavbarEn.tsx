import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";

// Anchors are written absolute ("/#how-it-works") so the header works
// identically from /investors and the legal routes. ScrollToTop performs the
// scroll. `top` marks the entries that also appear in the desktop row.
const navLinks: HeaderLink[] = [
  { label: "Who it is for", to: "/#who", top: true },
  { label: "The problem", to: "/#problem", top: true },
  { label: "How it works", to: "/#how-it-works", top: true },
  { label: "Business model", to: "/#business-model" },
  { label: "Capital", to: "/#capital", top: true },
  { label: "Auditability", to: "/#auditability" },
  { label: "Investors", to: "/investors", top: true },
  { label: "Evidence & sources", to: "/sources" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/#contact" },
];

const NavbarEn = () => (
  <SiteHeader
    home="/"
    lang="en"
    links={navLinks}
    other={{ label: "EN · PT", panelLabel: "Português", to: "/pt" }}
    primary={{ label: "Partner with us", to: "/#contact" }}
    appLabel="App · Devnet"
    menuLabel="Menu"
  />
);

export default NavbarEn;
