// The readiness scenarios, run by Deno against the copy the Edge Functions
// import. vitest runs the same file against the source.
//   npx deno test --allow-read platform/supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import vectors from "../../../../../packages/readiness-engine/vectors/scenarios.json" with { type: "json" };
import { assessReadiness, READINESS_MODEL_VERSION, type ReadinessRawInput } from "./index.ts";

Deno.test("scenarios match this model version", () => {
  assertEquals(vectors.model_version, READINESS_MODEL_VERSION);
});

for (const s of vectors.scenarios) {
  Deno.test(s.name, () => {
    const { result } = assessReadiness(s.input as ReadinessRawInput);
    const e = s.expect as Record<string, unknown>;
    assertEquals(result.status, e.status);
    assertEquals(result.missing_requirements, e.missing);
    assertEquals(result.reason_codes, e.reasons);
    if ("band" in e) assertEquals(result.band, e.band);
    if ("score" in e) assertEquals(result.score, e.score);
  });
}
