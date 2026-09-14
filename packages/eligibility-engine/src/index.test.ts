// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalize, type CanonicalObject } from "@empowerfi/audit-commitments";
import vectors from "../vectors/scenarios.json";
import { assessEligibility, ELIGIBILITY_MODEL_VERSION, instalment, maxAmountFor, RULES, type EligibilityInput } from "./index.ts";

// Expectations in vectors/scenarios.json were reasoned from the rules by hand.

describe("scenarios", () => {
  it("are written for this model version", () => expect(vectors.model_version).toBe(ELIGIBILITY_MODEL_VERSION));
  for (const s of vectors.scenarios) {
    it(s.name, () => {
      const result = assessEligibility(s.input as EligibilityInput);
      for (const [field, value] of Object.entries(s.expect)) {
        expect(result[field as keyof typeof result], field).toEqual(value);
      }
    });
  }
});

describe("properties", () => {
  const inputs = vectors.scenarios.map((s) => s.input as EligibilityInput);

  it("never proposes an instalment above the maximum", () => {
    for (const i of inputs) {
      const r = assessEligibility(i);
      if (r.instalment_cents !== null) expect(r.instalment_cents).toBeLessThanOrEqual(r.max_instalment_cents);
    }
  });

  it("suggests a range that runs upwards, in R$ 100 steps", () => {
    for (const i of inputs) {
      const r = assessEligibility(i);
      if (r.suggested_min_cents !== null && r.suggested_max_cents !== null) {
        expect(r.suggested_min_cents).toBeLessThanOrEqual(r.suggested_max_cents);
        expect(r.suggested_max_cents % RULES.AMOUNT_STEP_CENTS).toBe(0);
      }
    }
  });

  it("only takes something to a partner when it is eligible or for review", () => {
    for (const i of inputs) {
      const r = assessEligibility(i);
      expect(r.proposed_amount_cents !== null).toBe(r.decision !== "NOT_ELIGIBLE");
    }
  });

  it("is deterministic and canonical-JSON safe", () => {
    for (const i of inputs) {
      expect(assessEligibility(i)).toEqual(assessEligibility(structuredClone(i)));
      expect(() => canonicalize(assessEligibility(i) as unknown as CanonicalObject)).not.toThrow();
    }
  });

  it("sizes the largest amount that still fits", () => {
    const max = maxAmountFor(27_500, 12);
    expect(instalment(max, 12)).toBeLessThanOrEqual(27_500);
    expect(instalment(max + RULES.AMOUNT_STEP_CENTS, 12)).toBeGreaterThan(27_500);
  });
});
