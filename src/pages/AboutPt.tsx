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
import { aboutPt } from "@/content/about";
import { mediaPt, mediaItemsPt } from "@/content/media";
import { faqSchema, organizationSchema, softwareApplicationSchema } from "@/config/structuredData";

const jsonLd = [
  organizationSchema(),
  softwareApplicationSchema(),
  faqSchema(aboutPt.faq.items),
];

const alternates = [
  { hreflang: "en", path: "/about" },
  { hreflang: "pt-BR", path: "/pt/sobre" },
  { hreflang: "x-default", path: "/about" },
];

const AboutPt = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title={aboutPt.meta.title}
      description={aboutPt.meta.description}
      path="/pt/sobre"
      lang="pt-BR"
      alternates={alternates}
      jsonLd={jsonLd}
    />
    <AboutNavbar nav={aboutPt.nav} homePath="/pt" langSwitchPath="/about" />
    <AboutHero hero={aboutPt.hero} />
    <AboutStory story={aboutPt.story} />
    <AboutProblem problem={aboutPt.problem} />
    <AboutSolution solution={aboutPt.solution} />
    <AboutMissionVision missionVision={aboutPt.missionVision} />
    <AboutValues values={aboutPt.values} />
    <AboutTeam team={aboutPt.team} founderPhotoSrc={founderPhoto} />
    <AboutPartners partners={aboutPt.partners} />
    <AboutRecognitions recognitions={aboutPt.recognitions} />
    <AboutMedia media={mediaPt} items={mediaItemsPt} pageLang="pt-BR" />
    <AboutFaq faq={aboutPt.faq} />
    <AboutContact contact={aboutPt.contact} />
    <InstitutionalFooter footer={aboutPt.footer} homePath="/pt" lang="pt-BR" />
  </div>
);

export default AboutPt;
