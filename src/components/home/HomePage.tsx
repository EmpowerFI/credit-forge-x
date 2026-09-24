import HomeHero from "./HomeHero";
import { HomeAudiences, HomeAuditability, HomeCapital, HomeHowItWorks, HomePilot, HomeProblem, HomeRevenue } from "./HomeSections";
import HomeTraction from "./HomeTraction";
import type { Lang } from "./copy";

/**
 * The home page, the same story in both languages (refactor spec §8, restruck
 * against the founder's reference of 24 Sep): hero, who it is for, the problem,
 * what the pilot must show, how it works, two revenue engines, capital,
 * auditability, traction and where you fit.
 *
 * "Who it is for" comes second on purpose: a reader decides which of the three
 * sides they are on before they can care about the problem. Everything longer —
 * readiness in depth, benchmarks and regulation — lives on /investors and
 * /sources.
 */
const HomePage = ({ lang }: { lang: Lang }) => (
  <>
    <HomeHero lang={lang} />
    <HomeAudiences lang={lang} />
    <HomeProblem lang={lang} />
    <HomePilot lang={lang} />
    <HomeHowItWorks lang={lang} />
    <HomeRevenue lang={lang} />
    <HomeCapital lang={lang} />
    <HomeAuditability lang={lang} />
    <HomeTraction lang={lang} />
  </>
);

export default HomePage;
