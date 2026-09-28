// Schema.org markup shared by the institutional routes. Kept as builders rather
// than inline literals so the Organization node stays byte-identical everywhere
// it is published and search engines reconcile it to a single entity.

import {
  COMPANY_BRAND_NAME,
  COMPANY_CITY,
  COMPANY_CNPJ,
  COMPANY_COUNTRY_CODE,
  COMPANY_FOUNDING_YEAR,
  COMPANY_LEGAL_NAME,
  COMPANY_STATE,
  FOUNDER_LINKEDIN_URL,
  FOUNDER_NAME,
  SITE_URL,
} from "@/config/company";
import {
  APP_STORE_URL,
  CONTACT_EMAIL,
  INSTAGRAM_URL,
  LINKEDIN_URL,
  PLAY_STORE_URL,
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
    "EmpowerFI is building the capital infrastructure that connects productive businesses and local economies to the best-fit sources of capital, built in Brazil. It qualifies productive capital demand, maps the capital instruments available to a business or a territory, allocates local and domestic capital first, and evaluates the qualified demand that remains underserved for additional global capital. Servicing, repayment and outcomes are measured after deployment. EmpowerFI holds no lending, P2P, investment, FX or local-currency licence, and regulated financial functions are expected to operate through regulated structures and partners.",
  address: {
    "@type": "PostalAddress",
    addressLocality: COMPANY_CITY,
    addressRegion: COMPANY_STATE,
    addressCountry: COMPANY_COUNTRY_CODE,
  },
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
  // Only advertise the tax ID once it is confirmed — a blank taxID is worse
  // than an absent one.
  ...(COMPANY_CNPJ ? { taxID: COMPANY_CNPJ } : {}),
});

export const softwareApplicationSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: "EmpowerFI",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Android, iOS",
  url: PLAY_STORE_URL,
  installUrl: PLAY_STORE_URL,
  sameAs: [PLAY_STORE_URL, APP_STORE_URL],
  inLanguage: "pt-BR",
  description:
    "Marketplace que conecta microempreendedoras a novos clientes e constrói o histórico financeiro que abre acesso a crédito justo.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  // Free to download and sign up for. The product is freemium, so revisit this
  // once paid subscription plans ship — the install stays free, but the listing
  // should then also declare the in-app purchase range.
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
