import LegalPage from "@/components/legal/LegalPage";
import { termsPt } from "@/content/legal";

const alternates = [
  { hreflang: "en", path: "/terms" },
  { hreflang: "pt-BR", path: "/termos" },
  { hreflang: "x-default", path: "/terms" },
];

const TermsPt = () => <LegalPage doc={termsPt} lang="pt-BR" path="/termos" alternates={alternates} />;

export default TermsPt;
