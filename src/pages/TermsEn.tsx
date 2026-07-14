import LegalPage from "@/components/legal/LegalPage";
import { termsEn } from "@/content/legal";

const alternates = [
  { hreflang: "pt-BR", path: "/termos" },
  { hreflang: "en", path: "/en/terms" },
  { hreflang: "x-default", path: "/termos" },
];

const TermsEn = () => <LegalPage doc={termsEn} lang="en" path="/en/terms" alternates={alternates} />;

export default TermsEn;
