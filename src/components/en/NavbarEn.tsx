import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";

// Anchors are written absolute ("/#how-it-works") so the header works
// identically from /investors and the legal routes. ScrollToTop performs the
// scroll. `top: "lg"` marks the three that fit a 1024px bar; "xl" joins them
// when there is room; the rest are panel-only. The row shows the path of the
// argument, not the whole site.
const navLinks: HeaderLink[] = [
  { label: "How it works", to: "/#how-it-works", top: "lg" },
  { label: "Capital network", to: "/#capital-network", top: "lg" },
  { label: "Local economies", to: "/#local-economies", top: "lg" },
  { label: "Capital engines", to: "/#engines" },
  { label: "Who it is for", to: "/#who" },
  { label: "The problem", to: "/#problem" },
  { label: "Local capital first", to: "/#local-first" },
  { label: "Global capital", to: "/#global-capital" },
  { label: "Investable local economies", to: "/#north-star" },
  { label: "Business model", to: "/#business-model" },
  { label: "Technology", to: "/#technology" },
  { label: "Auditability", to: "/#auditability" },
  { label: "For capital providers", to: "/investors" },
  { label: "Pilot", to: "/investors#pilot" },
  { label: "Evidence & sources", to: "/sources" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/#contact" },
];

const NavbarEn = () => (
  <SiteHeader
    home="/"
    lang="en"
    links={navLinks}
    language={{ current: "EN", other: "PT", otherName: "Português", to: "/pt" }}
    primary={{ label: "Partner with us", to: "/#contact" }}
    appLabel="App · Devnet"
    menuLabel="Menu"
  />
);

export default NavbarEn;
