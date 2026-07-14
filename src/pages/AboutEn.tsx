import Seo from "@/components/Seo";
import AboutNavbar from "@/components/about/AboutNavbar";
import AboutHero from "@/components/about/AboutHero";
import AboutStory from "@/components/about/AboutStory";
import AboutProblem from "@/components/about/AboutProblem";
import AboutSolution from "@/components/about/AboutSolution";
import AboutMissionVision from "@/components/about/AboutMissionVision";
import AboutValues from "@/components/about/AboutValues";
import AboutFounder from "@/components/about/AboutFounder";
import AboutRecognitions from "@/components/about/AboutRecognitions";
import AboutFaq from "@/components/about/AboutFaq";
import AboutContact from "@/components/about/AboutContact";
import InstitutionalFooter from "@/components/InstitutionalFooter";
import founderPhoto from "@/assets/founder-daniele.png";
import { aboutEn } from "@/content/about";
import { faqSchema, organizationSchema, softwareApplicationSchema } from "@/config/structuredData";

const jsonLd = [
  organizationSchema(),
  softwareApplicationSchema(),
  faqSchema(aboutEn.faq.items),
];

const alternates = [
  { hreflang: "pt-BR", path: "/about" },
  { hreflang: "en", path: "/en/about" },
  { hreflang: "x-default", path: "/about" },
];

const AboutEn = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title={aboutEn.meta.title}
      description={aboutEn.meta.description}
      path="/en/about"
      lang="en"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <AboutNavbar nav={aboutEn.nav} homePath="/en" langSwitchPath="/about" />
    <AboutHero hero={aboutEn.hero} />
    <AboutStory story={aboutEn.story} />
    <AboutProblem problem={aboutEn.problem} />
    <AboutSolution solution={aboutEn.solution} />
    <AboutMissionVision missionVision={aboutEn.missionVision} />
    <AboutValues values={aboutEn.values} />
    <AboutFounder founder={aboutEn.founder} photoSrc={founderPhoto} />
    <AboutRecognitions recognitions={aboutEn.recognitions} />
    <AboutFaq faq={aboutEn.faq} />
    <AboutContact contact={aboutEn.contact} />
    <InstitutionalFooter footer={aboutEn.footer} homePath="/en" lang="en" />
  </div>
);

export default AboutEn;
