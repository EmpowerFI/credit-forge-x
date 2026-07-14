import LegalPage from "@/components/legal/LegalPage";
import { privacyPt } from "@/content/legal";

const alternates = [
  { hreflang: "pt-BR", path: "/privacidade" },
  { hreflang: "en", path: "/en/privacy" },
  { hreflang: "x-default", path: "/privacidade" },
];

const Privacy = () => (
  <LegalPage doc={privacyPt} lang="pt-BR" path="/privacidade" alternates={alternates} />
);

export default Privacy;
