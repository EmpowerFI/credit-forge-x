import LegalPage from "@/components/legal/LegalPage";
import { termsPt } from "@/content/legal";

const alternates = [
  { hreflang: "pt-BR", path: "/termos" },
  { hreflang: "en", path: "/en/terms" },
  { hreflang: "x-default", path: "/termos" },
];

const Terms = () => <LegalPage doc={termsPt} lang="pt-BR" path="/termos" alternates={alternates} />;

export default Terms;
