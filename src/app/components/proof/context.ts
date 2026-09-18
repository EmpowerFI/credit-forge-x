import { createContext, useContext } from "react";
import type { PoolId } from "../../lib/capital";
import type { RouteReason, SettlementRoute } from "../../lib/settlementRoute";
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
  /**
   * The settlement route this disbursement took (addendum §8.3). Recorded in
   * EmpowerFI's ledger and computed from the rate cards, not anchored on chain:
   * the proof above is the disbursement itself.
   */
  settlement?: {
    route: SettlementRoute;
    quoted_at: string;
    net_brl_cents: number;
    source: string;
    source_url: string | null;
    reason_code: RouteReason | null;
    reality: string;
    model_version: string;
  } | null;
}

export const ProofDrawerContext = createContext<((proof: ProofTarget) => void) | null>(null);

/** Opens the proof drawer; null outside the app's layout, where proofs link to the audit page instead. */
export const useProofDrawer = () => useContext(ProofDrawerContext);
