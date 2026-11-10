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
    <SiteNav lang="en" page="about" />
    <AboutHero hero={aboutEn.hero} />
    <AboutStory story={aboutEn.story} />
    <AboutProblem problem={aboutEn.problem} />
    <AboutSolution solution={aboutEn.solution} />
    <AboutMissionVision missionVision={aboutEn.missionVision} />
    <AboutValues values={aboutEn.values} />
    <AboutTeam team={aboutEn.team} founderPhotoSrc={founderPhoto} />
    <AboutPartners partners={aboutEn.partners} />
    <AboutStrategy strategy={aboutEn.strategy} lang="en" />
    <AboutAwards awards={aboutEn.awards} />
    <AboutRecognitions recognitions={aboutEn.recognitions} />
    <AboutMedia media={mediaEn} items={mediaItemsEn} pageLang="en" />
    <AboutFaq faq={aboutEn.faq} />
    <AboutContact contact={aboutEn.contact} />
    <SiteFoot lang="en" page="about" />
  </div>
);

export default About;
