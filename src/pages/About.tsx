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
import { aboutPt } from "@/content/about";
import { faqSchema, organizationSchema, softwareApplicationSchema } from "@/config/structuredData";

const jsonLd = [
  organizationSchema(),
  softwareApplicationSchema(),
  faqSchema(aboutPt.faq.items),
];

const alternates = [
  { hreflang: "pt-BR", path: "/about" },
  { hreflang: "en", path: "/en/about" },
  { hreflang: "x-default", path: "/about" },
];

const About = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title={aboutPt.meta.title}
      description={aboutPt.meta.description}
      path="/about"
      lang="pt-BR"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <AboutNavbar nav={aboutPt.nav} homePath="/" langSwitchPath="/en/about" />
    <AboutHero hero={aboutPt.hero} />
    <AboutStory story={aboutPt.story} />
    <AboutProblem problem={aboutPt.problem} />
    <AboutSolution solution={aboutPt.solution} />
    <AboutMissionVision missionVision={aboutPt.missionVision} />
    <AboutValues values={aboutPt.values} />
    <AboutFounder founder={aboutPt.founder} photoSrc={founderPhoto} />
    <AboutRecognitions recognitions={aboutPt.recognitions} />
    <AboutFaq faq={aboutPt.faq} />
    <AboutContact contact={aboutPt.contact} />
    <InstitutionalFooter footer={aboutPt.footer} homePath="/" lang="pt-BR" />
  </div>
);

export default About;
