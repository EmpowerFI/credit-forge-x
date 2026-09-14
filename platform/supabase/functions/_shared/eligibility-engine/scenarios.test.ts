// The eligibility scenarios, run by Deno against the copy the Edge Functions
// import. vitest runs the same file against the source.
import { assertEquals } from "jsr:@std/assert@1";
import vectors from "../../../../../packages/eligibility-engine/vectors/scenarios.json" with { type: "json" };
import { assessEligibility, ELIGIBILITY_MODEL_VERSION, type EligibilityInput } from "./index.ts";

Deno.test("scenarios match this model version", () => {
  assertEquals(vectors.model_version, ELIGIBILITY_MODEL_VERSION);
});

for (const s of vectors.scenarios) {
  Deno.test(s.name, () => {
    const result = assessEligibility(s.input as EligibilityInput);
    for (const [field, value] of Object.entries(s.expect)) {
      assertEquals(result[field as keyof typeof result], value, field);
    }
  });
}
