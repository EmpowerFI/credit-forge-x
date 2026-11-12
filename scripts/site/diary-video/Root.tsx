import { Composition } from "remotion";
import { DiaryFilm, DURATION } from "./DiaryFilm";

export const Root = () => (
  <>
    <Composition id="DiaryPt" component={DiaryFilm} durationInFrames={DURATION} fps={30} width={1920} height={1080} defaultProps={{ lang: "pt" as const }} />
    <Composition id="DiaryEn" component={DiaryFilm} durationInFrames={DURATION} fps={30} width={1920} height={1080} defaultProps={{ lang: "en" as const }} />
  </>
);
