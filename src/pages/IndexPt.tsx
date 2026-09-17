import Seo from "@/components/Seo";
import Footer from "@/components/pt/Footer";
import Navbar from "@/components/pt/Navbar";
import HomePage from "@/components/home/HomePage";
import { HOME } from "@/components/home/copy";
import { organizationSchema } from "@/config/structuredData";

// index.html carries the English corporate meta, so the Portuguese page has to
// declare its own — otherwise it would advertise itself to crawlers and link
// previews as the English page.
const alternates = [
  { hreflang: "en", path: "/" },
  { hreflang: "pt-BR", path: "/pt" },
  { hreflang: "x-default", path: "/" },
];

const jsonLd = [organizationSchema()];

/**
 * The home page in Portuguese: the same seven-section story as "/" (founder's
 * decision, 16 Sep), because the sponsors of Brazilian ESG and entrepreneurship
 * programs read in Portuguese. The page written for the woman who runs the
 * business moved to /pt/empreendedoras.
 */
const IndexPt = () => (
  <div className="min-h-screen bg-background">
    <Seo title={HOME.pt.seo.title} description={HOME.pt.seo.description} path="/pt" lang="pt-BR" alternates={alternates} jsonLd={jsonLd} />
    <Navbar />
    <HomePage lang="pt" />
    <Footer />
  </div>
);

export default IndexPt;
