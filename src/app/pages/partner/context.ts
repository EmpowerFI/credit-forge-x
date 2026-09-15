import { useOutletContext } from "react-router-dom";
import type { PartnerDesk } from "../../lib/partner";

export interface DeskContext {
  desk: PartnerDesk;
  /** The signed-in user acts for this partner: decides, disburses, records payments. */
  decides: boolean;
}

/** The desk's five views read the same data: one read, shared below. */
export const useDesk = () => useOutletContext<DeskContext>();
