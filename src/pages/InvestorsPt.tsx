import Seo from "@/components/Seo";
import InvestorHero from "@/components/investors/InvestorHero";
import InvestorThesis from "@/components/investors/InvestorThesis";
import InvestorWaitlistSection from "@/components/investors/InvestorWaitlistSection";
import PilotMetrics from "@/components/investors/PilotMetrics";
import Footer from "@/components/pt/Footer";
import Navbar from "@/components/pt/Navbar";
import { organizationSchema } from "@/config/structuredData";

const alternates = [
  { hreflang: "en", path: "/investors" },
  { hreflang: "pt-BR", path: "/pt/investidores" },
  { hreflang: "x-default", path: "/investors" },
];

const jsonLd = [organizationSchema()];

/**
 * A página para investidores, em português. Mesma substância de /investors,
 * escrita para investidores brasileiros: o pool doméstico, em reais, vem
 * primeiro, e a lista de espera já chega com Brasil e o pool doméstico
 * selecionados. Os textos das duas páginas ficam lado a lado em
 * components/investors/copy.ts.
 *
 * Nada aqui pode soar como oferta: o aviso de protótipo e a frase de "não é
 * oferta" ficam logo no topo, e as métricas continuam vazias até serem reais.
 */
const InvestorsPt = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Investidores — crédito produtivo P2P da EmpowerFI"
      description="Crédito produtivo P2P para negócios de mulheres no Brasil, com dois pools: investidores brasileiros em reais, e investidores internacionais e de impacto em USDC. Hoje, um protótipo na Solana devnet. Entre na lista de espera, sem compromisso."
      path="/pt/investidores"
      lang="pt-BR"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <Navbar />
    <InvestorHero lang="pt" path="/pt/investidores" />
    <InvestorWaitlistSection lang="pt" />
    <InvestorThesis lang="pt" />
    <PilotMetrics lang="pt" />
    <Footer />
  </div>
);

export default InvestorsPt;
