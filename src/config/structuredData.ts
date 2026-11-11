// Schema.org markup shared by the institutional routes. Kept as builders rather
// than inline literals so the Organization node stays byte-identical everywhere
// it is published and search engines reconcile it to a single entity.

import {
  COMPANY_BRAND_NAME,
  COMPANY_FOUNDING_YEAR,
  COMPANY_LEGAL_NAME,
  FOUNDER_LINKEDIN_URL,
  FOUNDER_NAME,
  SITE_URL,
} from "@/config/company";
import {
  CONTACT_EMAIL,
  INSTAGRAM_URL,
  LINKEDIN_URL,
  X_URL,
} from "@/config/links";

export const organizationSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: COMPANY_BRAND_NAME,
  legalName: COMPANY_LEGAL_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  foundingDate: COMPANY_FOUNDING_YEAR,
  description:
    "EmpowerFI builds simple financial tools and sponsored engagement campaigns for women entrepreneurs in Brazil. Entrepreneurs track sales, expenses and profit and keep daily financial records; organizations sponsor 30-day campaigns, priced per participant, with conditional rewards. Its long-term infrastructure is privacy-preserving, programmable financial reputation. EmpowerFI holds no lending or investment licence.",
  founder: {
    "@type": "Person",
    name: FOUNDER_NAME,
    jobTitle: "Founder & CEO",
    sameAs: [FOUNDER_LINKEDIN_URL],
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: CONTACT_EMAIL,
    availableLanguage: ["Portuguese", "English"],
  },
  sameAs: [LINKEDIN_URL, INSTAGRAM_URL, X_URL],
  // Unicamp's official recognition, so the distinction is machine-readable and
  // not only a mark on a card.
  award: "Selo Empresa-filha da Unicamp (Unicamp Ventures)",
});

export const softwareApplicationSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: "EmpowerFI",
  applicationCategory: "FinanceApplication",
  // The diary on the web; the store apps are being retired.
  operatingSystem: "Web",
  url: `${SITE_URL}/app/diario`,
  inLanguage: "pt-BR",
  description:
    "Diário da EmpowerFI para mulheres que empreendem, no navegador do celular: organize o negócio e participe de oportunidades patrocinadas.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  // Free to use. Revisit this if paid plans ever ship.
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
  },
});

export const faqSchema = (
  faqs: { q: string; a: string }[],
): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});
