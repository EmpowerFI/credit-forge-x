// Official sources behind every figure the site quotes.
//
// Kept in its own module so a number and its provenance move together: if a
// statistic changes on the site, the entry here changes with it. The rule the
// business-model document sets is simple and worth restating — always record
// the year, the scope and the definition, and never convert a financing gap
// into addressable revenue.

export interface SourceEntry {
  title: string;
  /** What this source actually supports, in the site's own words. */
  supports: string;
  /** Scope, year or definition a careful reader needs before reusing it. */
  caveat?: string;
  url: string;
}

export interface SourceGroup {
  heading: string;
  entries: SourceEntry[];
}

export const sourceGroups: SourceGroup[] = [
  {
    heading: "Market",
    entries: [
      {
        title: "MEMP — Mapa de Empresas / Observatório do Empreendedorismo Feminino (2026)",
        supports:
          "9,958,797 active businesses in Brazil led by women — 39.7% of the total; 94% of active businesses are small businesses.",
        url: "https://www.gov.br/empresas-e-negocios/pt-br/drei/novos-paineis-do-mapa-de-empresas-e-observatorio-do-empreendedorismo-feminino/mapa-de-empresas-especial-mulheres-1.pdf",
      },
      {
        title: "IFC and Sicredi (2025)",
        supports:
          "2.6% of women-owned micro and small enterprises access formal loans, against 4.6% of men-owned ones; an estimated US$15.8 billion financing gap.",
        caveat:
          "The 2.6% figure measures access to formal loans in the cited sample. It does not mean 97.4% of women were refused credit.",
        url: "https://www.ifc.org/pt/pressroom/2025/ifc-and-sicredi-expand-access-to-finance-for-women-led-micro-and-small-enterprises",
      },
      {
        title: "IFC / G20 GPFI — Action Plan for MSME Financing (2025)",
        supports:
          "US$5.7 trillion MSME financing gap across emerging markets and developing economies, of which 34% is attributed to women-owned MSMEs.",
        caveat:
          "Base year 2019. Unmet financing need — not a revenue market, and not convertible into one.",
        url: "https://www.ifc.org/en/insights-reports/2025/gpfi-action-plan-for-msme-financing",
      },
    ],
  },
  {
    heading: "Unit economics and scale",
    entries: [
      {
        title: "World Bank — Working Paper 8252",
        supports:
          "Median operating expense of US$14 per US$100 of portfolio across the microfinance institutions analysed; institutions making smaller loans face particularly high unit costs.",
        caveat:
          "3,845 institution-years covering 291 million borrower-years, 2005–2009. Historical and international — it is not EmpowerFI's cost to serve, or Brazil's.",
        url: "https://documents.worldbank.org/curated/en/107171511360386561/pdf/WPS8252.pdf",
      },
      {
        title: "Banco do Nordeste — Crediamigo microfinance report (2024)",
        supports:
          "2.07 million active clients, 3.886 million loans disbursed, R$12.1 billion deployed, average ticket R$3,101.49.",
        caveat:
          "A benchmark of scale and operation, not a comparison of technology or audience.",
        url: "https://www.bnb.gov.br/documents/45775/375048/Relat%C3%B3rio%2Bde%2BMicrofinan%C3%A7as%2BCrediamigo%2B-%2B2024.pdf",
      },
    ],
  },
  {
    heading: "Regulation and methodology",
    entries: [
      {
        title: "Banco Central do Brasil — Resolução CMN 4.854",
        supports:
          "Defines guided productive microcredit: orientation on business planning, monitoring of the operation, and assessment of credit need, economic situation, indebtedness and cash flow.",
        url: "https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=4854&tipo=Resolu%C3%A7%C3%A3o+CMN",
      },
      {
        title: "Lei 15.364/2026, amending Lei 13.636",
        supports:
          "Admits digital and electronic technologies in place of in-person contact for orientation and obtaining credit.",
        caveat:
          "This permits digital methodology. It does not authorise EmpowerFI to grant credit — real operations depend on the applicable regulatory structure and on licensed partners.",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15364.htm",
      },
      {
        title: "Ministério do Trabalho e Emprego — PNMPO",
        supports:
          "Educational orientation, socio-economic assessment and monitoring as part of the national productive microcredit programme.",
        url: "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/trabalhador/empreendedorismo/pnmpo/historico-pnmpo",
      },
      {
        title: "Banco Central do Brasil — Resolução CMN 5.050",
        supports:
          "Governs direct credit companies (SCD) and peer-to-peer lending companies (SEP) operating through an electronic platform.",
        caveat:
          "Cited as the roadmap for a future capital layer. EmpowerFI holds no such licence today and is not a peer-to-peer lender.",
        url: "https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=5050&tipo=Resolu%C3%A7%C3%A3o+CMN",
      },
      {
        title: "BNDES — accreditation requirements for financial agents",
        supports:
          "Current requirements including technical capacity, minimum net equity and minimum time in operation.",
        url: "https://www.bndes.gov.br/wps/portal/site/home/instituicoes-financeiras-credenciadas/como-credenciar",
      },
    ],
  },
];
