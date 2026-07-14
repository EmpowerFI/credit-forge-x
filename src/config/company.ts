// Legal-entity data for the institutional pages (/about, /privacidade, /termos)
// and for the Schema.org Organization markup. This is what tells an Apple
// reviewer, an investor or a partner that a real company stands behind the app.

export const SITE_URL = "https://empowerfi.io";

export const COMPANY_LEGAL_NAME =
  "Daniele Rodrigues dos Santos Consultoria em Tecnologia da Informação LTDA";
export const COMPANY_BRAND_NAME = "EmpowerFI";

// Every surface that renders this checks for the empty string and omits the
// line, so blanking it out is enough to pull it from the site and the
// Organization markup.
export const COMPANY_CNPJ = "45.943.501/0001-40";

export const COMPANY_CITY = "São Paulo";
export const COMPANY_STATE = "SP";
export const COMPANY_COUNTRY = "Brasil";
export const COMPANY_COUNTRY_CODE = "BR";

export const COMPANY_FOUNDING_YEAR = "2025";

export const FOUNDER_NAME = "Daniele Rodrigues dos Santos";
export const FOUNDER_ROLE_PT = "Fundadora & CEO";
export const FOUNDER_ROLE_EN = "Founder & CEO";

// Personal profile of the founder — distinct from LINKEDIN_URL in links.ts,
// which points at the EmpowerFI company page.
export const FOUNDER_LINKEDIN_URL = "https://www.linkedin.com/in/drodrigues/";
