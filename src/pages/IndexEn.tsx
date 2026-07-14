import Seo from "@/components/Seo";
import NavbarEn from "@/components/en/NavbarEn";
import HeroSectionEn from "@/components/en/HeroSectionEn";
import ProblemSectionEn from "@/components/en/ProblemSectionEn";
import HowItWorksSectionEn from "@/components/en/HowItWorksSectionEn";
import DifferentialSectionEn from "@/components/en/DifferentialSectionEn";
import TractionSectionEn from "@/components/en/TractionSectionEn";
import CTASectionEn from "@/components/en/CTASectionEn";
import FooterEn from "@/components/en/FooterEn";

// index.html only carries the Portuguese home page's meta, so without this the
// English home would advertise itself to crawlers and link previews as pt-BR.
const alternates = [
  { hreflang: "pt-BR", path: "/" },
  { hreflang: "en", path: "/en" },
  { hreflang: "x-default", path: "/" },
];

const IndexEn = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="EmpowerFI — Financial infrastructure for women entrepreneurs"
      description="We connect micro-entrepreneurs to new customers, build the financial track record banks never saw, and open access to credit and impact capital. Marketplace live on Google Play."
      path="/en"
      lang="en"
      alternates={alternates}
    />
    <NavbarEn />
    <HeroSectionEn />
    <ProblemSectionEn />
    <HowItWorksSectionEn />
    <DifferentialSectionEn />
    <TractionSectionEn />
    <CTASectionEn />
    <FooterEn />
  </div>
);

export default IndexEn;
