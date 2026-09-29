import { CONTACT_EMAIL } from "@/config/links";
import SiteFooter, { type FooterColumn } from "@/components/site/SiteFooter";

const columns: FooterColumn[] = [
  {
    title: "Platform",
    links: [
      { label: "How it works", to: "/#how-it-works" },
      { label: "Capital engines", to: "/#engines" },
      { label: "Capital network", to: "/#capital-network" },
      { label: "Local economies", to: "/#local-economies" },
      { label: "Business model", to: "/#business-model" },
      { label: "Auditability", to: "/#auditability" },
    ],
  },
  {
    title: "For",
    links: [
      { label: "Entrepreneurs", to: "/pt/empreendedoras" },
      { label: "Capital providers", to: "/investors" },
      { label: "Investors", to: "/investors#waitlist" },
      { label: "Sponsors", to: "/#who" },
      { label: "Communities", to: "/#who" },
      { label: "Local programs", to: "/#who" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Pilot", to: "/investors#pilot" },
      { label: "Evidence & sources", to: "/sources" },
      { label: "Contact", to: "/#contact" },
      { label: "Terms", to: "/terms" },
      { label: "Privacy", to: "/privacy" },
      { label: "Email", href: `mailto:${CONTACT_EMAIL}` },
      { label: "Português", to: "/pt" },
    ],
  },
];

const FooterEn = () => (
  <SiteFooter
    home="/"
    tagline="Capital infrastructure connecting productive businesses to local, domestic and global capital. Global capital. Local circulation. Measurable prosperity."
    positioning="Capital infrastructure · Brazil first · Global by design"
    columns={columns}
    notices={[
      "Nothing on this site is an offer of securities, credit or a financial product. EmpowerFI does not currently operate a licensed lending, P2P, investment, FX or local-currency business. Joining a waitlist is a non-binding expression of interest, and no return is promised or implied.",
      "Prototype investments, returns, FX, local-currency conversion and settlement are simulated where explicitly identified; blockchain transactions use test assets on Solana Devnet. Future regulated financial functions are expected to operate through appropriate regulated structures and partners.",
    ]}
    rights="All rights reserved."
  />
);

export default FooterEn;
