import { createContext, useContext } from "react";
import type { PoolId } from "../../lib/capital";
import type { AnchorKind } from "../../lib/platform";

/** One proven fact, as much as the page showing it knows. The drawer fills in the rest when the viewer may read the record. */
export interface ProofTarget {
  kind: AnchorKind;
  entity_id?: string | null;
  status?: string | null;
  signature?: string | null;
  account?: string | null;
  commitment?: string | null;
  confirmed_at?: string | null;
  /** The pseudonymous subject the page knows it by, such as an opportunity's code. */
  subject?: string | null;
  model_version?: string | null;
  /** The funding route, for the proofs of an allocated opportunity. */
  route?: PoolId | null;
}

export const ProofDrawerContext = createContext<((proof: ProofTarget) => void) | null>(null);

/** Opens the proof drawer; null outside the app's layout, where proofs link to the audit page instead. */
export const useProofDrawer = () => useContext(ProofDrawerContext);
