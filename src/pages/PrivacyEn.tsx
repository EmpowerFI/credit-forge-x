import LegalPage from "@/components/legal/LegalPage";
import { privacyEn } from "@/content/legal";

const alternates = [
  { hreflang: "pt-BR", path: "/privacidade" },
  { hreflang: "en", path: "/en/privacy" },
  { hreflang: "x-default", path: "/privacidade" },
];

const PrivacyEn = () => (
  <LegalPage doc={privacyEn} lang="en" path="/en/privacy" alternates={alternates} />
);

export default PrivacyEn;
