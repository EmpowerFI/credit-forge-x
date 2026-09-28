import type { EvidenceLabel } from "./evidence";
import { platform } from "./platform";

// The figures on these screens that this product did not measure.
//
// They are the only numbers here published under somebody else's name, which
// makes them the ones a mistake costs the most: a wrong figure of our own is a
// bug, a wrong figure of theirs is a misquotation. So they live in one table
// with a source and a link, they are read whole rather than queried for, and
// pgTAP asserts the four the positioning panel prints.

/** A figure this product did not measure, carried with its source. */
export interface Benchmark {
  key: string;
  label: string;
  value_bps: number | null;
  value_cents: number | null;
  value_count: number | null;
  source: string;
  source_url: string;
  observed_period: string | null;
  note: string | null;
  evidence_status: EvidenceLabel;
}

export const referencePointsKey = ["platform", "reference-points"] as const;

export async function fetchReferencePoints(): Promise<Benchmark[]> {
  const { data, error } = await platform.rpc("reference_points_listed");
  if (error) throw error;
  return data as unknown as Benchmark[];
}

/** The citation under a key, or nothing — a screen omits what it cannot cite. */
export const pointOf = (points: Benchmark[] | undefined, key: string) =>
  points?.find((p) => p.key === key);
