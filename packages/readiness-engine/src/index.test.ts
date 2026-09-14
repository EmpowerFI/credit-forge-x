// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalize, type CanonicalObject } from "@empowerfi/audit-commitments";
import vectors from "../vectors/scenarios.json";
import {
  assessReadiness,
  computeFeatures,
  evaluateReadiness,
  READINESS_MODEL_VERSION,
  type ReadinessRawInput,
} from "./index.ts";

// Expectations in vectors/scenarios.json were reasoned from the rules by hand.
// Deno runs the same file against the copy the Edge Functions use.

describe("scenarios", () => {
  it("are written for this model version", () => {
    expect(vectors.model_version).toBe(READINESS_MODEL_VERSION);
  });

  for (const s of vectors.scenarios) {
    it(s.name, () => {
      const { result } = assessReadiness(s.input as ReadinessRawInput);
      const e = s.expect as Record<string, unknown>;
      expect(result.status).toBe(e.status);
      expect(result.missing_requirements).toEqual(e.missing);
      expect(result.reason_codes).toEqual(e.reasons);
      if ("band" in e) expect(result.band).toBe(e.band);
      if ("score" in e) expect(result.score).toBe(e.score);
    });
  }
});

describe("properties", () => {
  const ready = vectors.scenarios[0].input as ReadinessRawInput;

  it("does not depend on the order check-ins arrive in", () => {
    const shuffled = { ...ready, checkins: [...ready.checkins].reverse() };
    expect(assessReadiness(shuffled)).toEqual(assessReadiness(ready));
  });

  it("gives the same result every time", () => {
    expect(assessReadiness(ready)).toEqual(assessReadiness(structuredClone(ready)));
  });

  it("produces only values canonical JSON accepts, so it can be committed", () => {
    for (const s of vectors.scenarios) {
      const { features, result } = assessReadiness(s.input as ReadinessRawInput);
      expect(() => canonicalize(features as unknown as CanonicalObject)).not.toThrow();
      expect(() => canonicalize(result as unknown as CanonicalObject)).not.toThrow();
    }
  });

  it("re-evaluates identically from stored features alone", () => {
    const { features, result } = assessReadiness(ready);
    expect(evaluateReadiness(JSON.parse(JSON.stringify(features)))).toEqual(result);
  });

  it("keeps every component within 0–25", () => {
    for (const s of vectors.scenarios) {
      const { result } = assessReadiness(s.input as ReadinessRawInput);
      for (const v of Object.values(result.components)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(25);
      }
    }
  });

  it("carries its model version", () => {
    expect(assessReadiness(ready).result.model_version).toBe("readiness-v0.1.0");
  });
});

describe("input validation", () => {
  const base = vectors.scenarios[0].input as ReadinessRawInput;
  const month = base.checkins[0];

  it("refuses two check-ins for the same month", () => {
    expect(() => computeFeatures({ ...base, checkins: [month, month] })).toThrow(/two check-ins/);
  });
  it("refuses a check-in after the assessment month", () => {
    expect(() => computeFeatures({ ...base, checkins: [{ ...month, period: "2026-10" }] })).toThrow(/after/);
  });
  it("refuses negative or fractional money", () => {
    expect(() => computeFeatures({ ...base, checkins: [{ ...month, revenue_cents: -1 }] })).toThrow(/cents/);
    expect(() => computeFeatures({ ...base, checkins: [{ ...month, opex_cents: 10.5 }] })).toThrow(/cents/);
  });
  it("refuses malformed periods", () => {
    expect(() => computeFeatures({ ...base, as_of_period: "2026-13" })).toThrow(/YYYY-MM/);
  });
});
