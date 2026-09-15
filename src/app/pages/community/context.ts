import { useOutletContext } from "react-router-dom";
import type { Database } from "../../lib/platform.types";

export interface CommunityContext {
  community: Database["public"]["Tables"]["communities"]["Row"];
  /** The signed-in user leads it: she may log outreach, enroll and record education. */
  leads: boolean;
}

export const useCommunity = () => useOutletContext<CommunityContext>();
