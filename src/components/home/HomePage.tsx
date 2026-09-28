import HomeHero from "./HomeHero";
import {
  HomeAudiences, HomeAuditability, HomeEngines, HomeGlobal, HomeHowItWorks, HomeLocalFirst,
  HomeNetwork, HomeNorthStar, HomePilot, HomeProblem, HomeRails, HomeRevenue, HomeSolana,
} from "./HomeSections";
import HomeTraction from "./HomeTraction";
import type { Lang } from "./copy";

/**
 * The home page, the same story in both languages, in the order the argument
 * has to be made: what the company connects to what, the four engines that do
 * it, why the connection is broken today, how one need becomes routed capital,
 * what it can be routed to, why local capital goes first, what happens after
 * the capital lands, where the global side is stuck, and where all of it is
 * going.
 *
 * Who it is for comes after the argument rather than before it. The old page
 * put it second, when the company was a platform for three named sides; an
 * infrastructure company has to say what it is before a reader can tell which
 * side of it they are on.
 *
 * Technology is last on purpose. Leading with the rail is how an infrastructure
 * company gets mistaken for a crypto one.
 */
const HomePage = ({ lang }: { lang: Lang }) => (
  <>
    <HomeHero lang={lang} />
    <HomeEngines lang={lang} />
    <HomeProblem lang={lang} />
    <HomeHowItWorks lang={lang} />
    <HomeNetwork lang={lang} />
    <HomeLocalFirst lang={lang} />
    <HomeRails lang={lang} />
    <HomeGlobal lang={lang} />
    <HomeNorthStar lang={lang} />
    <HomeAudiences lang={lang} />
    <HomeRevenue lang={lang} />
    <HomePilot lang={lang} />
    <HomeSolana lang={lang} />
    <HomeAuditability lang={lang} />
    <HomeTraction lang={lang} />
  </>
);

export default HomePage;
