import Seo from "@/components/Seo";
import FooterEn from "@/components/en/FooterEn";
import NavbarEn from "@/components/en/NavbarEn";
import HomePage from "@/components/home/HomePage";
import { HOME } from "@/components/home/copy";
import { organizationSchema } from "@/config/structuredData";

// The English home declares its own meta, word for word what index.html
// carries, so crawlers and link previews read the same page whether or not they
// run JavaScript.
const alternates = [
  { hreflang: "en", path: "/" },
  { hreflang: "pt-BR", path: "/pt" },
  { hreflang: "x-default", path: "/" },
];

const jsonLd = [organizationSchema()];

/**
 * The corporate site's front door, in English: one economic loop in seven
 * sections (refactor spec, 16 Sep). /pt tells the same story in Portuguese; the
 * entrepreneur's own page is /pt/empreendedoras.
 */
const Index = () => (
  <div className="min-h-screen bg-background">
    <Seo title={HOME.en.seo.title} description={HOME.en.seo.description} path="/" lang="en" alternates={alternates} jsonLd={jsonLd} />
    <NavbarEn />
    <HomePage lang="en" />
    <FooterEn />
  </div>
);

export default Index;
