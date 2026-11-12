import { Composition } from "remotion";
import { SponsorSite, DURATION } from "./SponsorSite";

export const Root = () => (
  <>
    <Composition id="SiteSponsorPt" component={SponsorSite} durationInFrames={DURATION} fps={30} width={1920} height={1080} defaultProps={{ lang: "pt" as const }} />
    <Composition id="SiteSponsorEn" component={SponsorSite} durationInFrames={DURATION} fps={30} width={1920} height={1080} defaultProps={{ lang: "en" as const }} />
  </>
);
