import Seo from "@/components/Seo";
import AboutHero from "@/components/about/AboutHero";
import AboutStory from "@/components/about/AboutStory";
import AboutProblem from "@/components/about/AboutProblem";
import AboutSolution from "@/components/about/AboutSolution";
import AboutMissionVision from "@/components/about/AboutMissionVision";
import AboutValues from "@/components/about/AboutValues";
import AboutTeam from "@/components/about/AboutTeam";
import AboutPartners from "@/components/about/AboutPartners";
import AboutStrategy from "@/components/about/AboutStrategy";
import AboutMedia from "@/components/about/AboutMedia";
import AboutAwards from "@/components/about/AboutAwards";
import AboutRecognitions from "@/components/about/AboutRecognitions";
import AboutFaq from "@/components/about/AboutFaq";
import AboutContact from "@/components/about/AboutContact";
import { SiteFoot, SiteNav } from "@/site/parts";
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
    <SiteNav lang="pt" page="about" />
    <AboutHero hero={aboutPt.hero} />
    <AboutStory story={aboutPt.story} />
    <AboutProblem problem={aboutPt.problem} />
    <AboutSolution solution={aboutPt.solution} />
    <AboutMissionVision missionVision={aboutPt.missionVision} />
    <AboutValues values={aboutPt.values} />
    <AboutTeam team={aboutPt.team} founderPhotoSrc={founderPhoto} />
    <AboutPartners partners={aboutPt.partners} />
    <AboutStrategy strategy={aboutPt.strategy} lang="pt" />
    <AboutAwards awards={aboutPt.awards} />
    <AboutRecognitions recognitions={aboutPt.recognitions} />
    <AboutMedia media={mediaPt} items={mediaItemsPt} pageLang="pt-BR" />
    <AboutFaq faq={aboutPt.faq} />
    <AboutContact contact={aboutPt.contact} />
    <SiteFoot lang="pt" page="about" />
  </div>
);

export default AboutPt;
