import { useQuery } from "@tanstack/react-query";
import type { EvidenceLabel } from "../../lib/evidence";
import { evidenceKey, fetchEvidenceLedger, type FamilyKey } from "../../lib/evidenceLedger";
import EvidenceTag from "./EvidenceTag";

// One mark per screen, saying what kind of numbers it holds (addendum v3 §9).
//
// The label is read rather than written into the page. A screen that hardcoded
// "Simulated" would go on saying it after the figure underneath it became real,
// which is the failure mode this vocabulary exists to prevent — so the family a
// screen draws from decides, and a screen that mixes families falls back to the
// weakest thing the product may claim at all.
//
// Nothing renders until the reading arrives. An absent mark is better than a
// placeholder one: a reader who sees "Simulated" flash into "Observed" learns
// to distrust both.

export default function PageEvidence({ family }: { family?: FamilyKey }) {
  const ledger = useQuery({ queryKey: evidenceKey, queryFn: fetchEvidenceLedger, staleTime: 60_000 });
  if (!ledger.data) return null;
  const label: EvidenceLabel =
    (family === undefined ? undefined : ledger.data.families.find((f) => f.key === family)?.evidence)
    ?? ledger.data.weakest;
  return <EvidenceTag label={label} />;
}
