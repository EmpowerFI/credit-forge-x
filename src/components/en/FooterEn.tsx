import { CONTACT_EMAIL } from "@/config/links";
import SiteFooter, { type FooterColumn } from "@/components/site/SiteFooter";

const columns: FooterColumn[] = [
  {
    title: "Platform",
    links: [
      { label: "Who it is for", to: "/#who" },
      { label: "How it works", to: "/#how-it-works" },
      { label: "Business model", to: "/#business-model" },
      { label: "Capital", to: "/#capital" },
      { label: "Auditability", to: "/#auditability" },
    ],
  },
  {
    title: "For",
    links: [
      { label: "Program sponsors", to: "/#who" },
      { label: "Entrepreneurs", to: "/pt/empreendedoras" },
      { label: "Investors", to: "/investors" },
      { label: "Pilot roadmap", to: "/investors#pilot" },
      { label: "Contact", to: "/#contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Evidence & sources", to: "/sources" },
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
    tagline="Productive-credit and impact intelligence infrastructure: from program execution to auditable evidence and productive capital."
    positioning="RWA · Impact fintech · Brazil → LatAm"
    columns={columns}
    notices={[
      "Nothing on this site is an offer of securities or of a financial product. Joining a waitlist is a non-binding expression of interest. No return is promised or implied.",
      "Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.",
    ]}
    rights="All rights reserved."
  />
);

export default FooterEn;
