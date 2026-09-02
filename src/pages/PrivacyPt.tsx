import LegalPage from "@/components/legal/LegalPage";
import { privacyPt } from "@/content/legal";

const alternates = [
  { hreflang: "en", path: "/privacy" },
  { hreflang: "pt-BR", path: "/privacidade" },
  { hreflang: "x-default", path: "/privacy" },
];

const PrivacyPt = () => (
  <LegalPage doc={privacyPt} lang="pt-BR" path="/privacidade" alternates={alternates} />
);

export default PrivacyPt;
