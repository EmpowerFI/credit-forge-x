import SiteHeader, { type HeaderLink } from "@/components/site/SiteHeader";

// Anchors are written absolute ("/#how-it-works") so the header works
// identically from /investors and the legal routes. ScrollToTop performs the
// scroll. `top: "lg"` marks the three that fit a 1024px bar; "xl" joins them
// when there is room; the rest are panel-only.
const navLinks: HeaderLink[] = [
  { label: "Who it is for", to: "/#who", top: "lg" },
  { label: "How it works", to: "/#how-it-works", top: "lg" },
  { label: "Investors", to: "/investors", top: "lg" },
  { label: "The problem", to: "/#problem", top: "xl" },
  { label: "Capital", to: "/#capital", top: "xl" },
  { label: "Business model", to: "/#business-model" },
  { label: "Auditability", to: "/#auditability" },
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
