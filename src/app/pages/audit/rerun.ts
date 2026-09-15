import { canonicalize, type CanonicalObject } from "@empowerfi/audit-commitments";
import { assessEligibility, type EligibilityInput } from "@empowerfi/eligibility-engine";
import { evaluateReadiness, type ReadinessFeatures } from "@empowerfi/readiness-engine";
import { ELIGIBILITY_RESULT_FIELDS, READINESS_RESULT_FIELDS } from "../../lib/audit";
import { fetchModelSample } from "./queries";

const same = (a: unknown, b: unknown) => canonicalize({ v: a } as CanonicalObject) === canonicalize({ v: b } as CanonicalObject);

export interface Rerun { kind: "readiness" | "eligibility"; id: string; ok: boolean; version: string }

/** Re-runs the latest decisions through the engines bundled in this page: determinism, checked here. */
export async function rerun(): Promise<Rerun[]> {
  const sample = await fetchModelSample(12);
  const out: Rerun[] = [];
  for (const { id, payload } of sample.readiness) {
    const r = evaluateReadiness(payload.features as unknown as ReadinessFeatures);
    out.push({ kind: "readiness", id, version: String(payload.model_version), ok: READINESS_RESULT_FIELDS.every((f) => same(r[f], payload[f])) });
  }
  for (const { id, payload } of sample.eligibility) {
    const r = assessEligibility(payload.inputs as unknown as EligibilityInput);
    out.push({ kind: "eligibility", id, version: String(payload.model_version), ok: ELIGIBILITY_RESULT_FIELDS.every((f) => same(r[f], payload[f])) });
  }
  return out;
}

