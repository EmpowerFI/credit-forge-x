import { describe, expect, it } from "vitest";
import { computeFeatures, type ReadinessRawInput } from "@empowerfi/readiness-engine";
import vectors from "../../../packages/readiness-engine/vectors/scenarios.json";
import { insightsFrom } from "./insights";

const features = (name: string) =>
  computeFeatures(vectors.scenarios.find((s) => s.name === name)!.input as ReadinessRawInput);

describe("insights", () => {
  it("say nothing they cannot back with data", () => {
    expect(insightsFrom(features("no check-ins yet"))).toEqual([]);
  });

  it("describe a steady, regular business", () => {
    const texts = insightsFrom(features("prepared, steady, six months of reporting")).map((i) => i.text);
    expect(texts).toContain("Sales have held roughly level over the last months.");
    expect(texts.some((t) => t.startsWith("The business keeps about"))).toBe(true);
    expect(texts).toContain("Six months reported in a row: that record is what makes the business legible.");
  });

  it("flag falling sales and a household draw above profit", () => {
    const insights = insightsFrom(features("costs overtook sales in the last two months"));
    expect(insights.map((i) => i.text)).toContain("Sales in recent months are 22% below the months before.");
    expect(insights.find((i) => i.text.startsWith("About 104%"))?.tone).toBe("watch");
  });

  it("notice a record that has gone quiet", () => {
    const texts = insightsFrom(features("stopped reporting three months ago")).map((i) => i.text);
    expect(texts).toContain("The last check-in was 3 months ago. Reporting this month restarts the record.");
  });

  it("are the same sentences for the same features", () => {
    const f = features("revenue swings too far for fixed rules");
    expect(insightsFrom(f)).toEqual(insightsFrom(structuredClone(f)));
  });
});
