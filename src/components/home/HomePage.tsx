import HomeHero from "./HomeHero";
import { HomeAuditability, HomeCapital, HomeHowItWorks, HomeProblem, HomeRevenue } from "./HomeSections";
import HomeTraction from "./HomeTraction";
import type { Lang } from "./copy";

/**
 * The home page in seven sections, the same story in both languages (refactor
 * spec §8): hero, problem, how it works, two revenue engines, capital,
 * auditability, traction and where you fit. Everything longer — the pilot's
 * roadmap, readiness in depth, benchmarks and regulation — lives on /investors
 * and /sources.
 */
const HomePage = ({ lang }: { lang: Lang }) => (
  <>
    <HomeHero lang={lang} />
    <HomeProblem lang={lang} />
    <HomeHowItWorks lang={lang} />
    <HomeRevenue lang={lang} />
    <HomeCapital lang={lang} />
    <HomeAuditability lang={lang} />
    <HomeTraction lang={lang} />
  </>
);

export default HomePage;
