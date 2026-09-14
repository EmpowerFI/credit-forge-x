import Seo from "@/components/Seo";
import AboutNavbar from "@/components/about/AboutNavbar";
import AboutHero from "@/components/about/AboutHero";
import AboutStory from "@/components/about/AboutStory";
import AboutProblem from "@/components/about/AboutProblem";
import AboutSolution from "@/components/about/AboutSolution";
import AboutMissionVision from "@/components/about/AboutMissionVision";
import AboutValues from "@/components/about/AboutValues";
import AboutTeam from "@/components/about/AboutTeam";
import AboutPartners from "@/components/about/AboutPartners";
import AboutMedia from "@/components/about/AboutMedia";
import AboutRecognitions from "@/components/about/AboutRecognitions";
import AboutFaq from "@/components/about/AboutFaq";
import AboutContact from "@/components/about/AboutContact";
import InstitutionalFooter from "@/components/InstitutionalFooter";
import founderPhoto from "@/assets/founder-daniele.png";
import { aboutEn } from "@/content/about";
import { mediaEn, mediaItemsEn } from "@/content/media";
import { faqSchema, organizationSchema, softwareApplicationSchema } from "@/config/structuredData";

const jsonLd = [
  organizationSchema(),
  softwareApplicationSchema(),
  faqSchema(aboutEn.faq.items),
];

const alternates = [
  { hreflang: "en", path: "/about" },
  { hreflang: "pt-BR", path: "/pt/sobre" },
  { hreflang: "x-default", path: "/about" },
];

const About = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title={aboutEn.meta.title}
      description={aboutEn.meta.description}
      path="/about"
      lang="en"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <AboutNavbar nav={aboutEn.nav} homePath="/" langSwitchPath="/pt/sobre" />
    <AboutHero hero={aboutEn.hero} />
    <AboutStory story={aboutEn.story} />
    <AboutProblem problem={aboutEn.problem} />
    <AboutSolution solution={aboutEn.solution} />
    <AboutMissionVision missionVision={aboutEn.missionVision} />
    <AboutValues values={aboutEn.values} />
    <AboutTeam team={aboutEn.team} founderPhotoSrc={founderPhoto} />
    <AboutPartners partners={aboutEn.partners} />
    <AboutRecognitions recognitions={aboutEn.recognitions} />
    <AboutMedia media={mediaEn} items={mediaItemsEn} pageLang="en" />
    <AboutFaq faq={aboutEn.faq} />
    <AboutContact contact={aboutEn.contact} />
    <InstitutionalFooter footer={aboutEn.footer} homePath="/" lang="en" />
  </div>
);

export default About;
