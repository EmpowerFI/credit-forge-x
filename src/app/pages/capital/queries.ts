import { useQuery } from "@tanstack/react-query";
import { engineOpportunitiesKey, fetchEngineOpportunities } from "../../lib/engine";

/** The qualified opportunities the engine page selects from, as the caller may see them. */
export function useEngineOpportunities() {
  return useQuery({ queryKey: engineOpportunitiesKey, queryFn: fetchEngineOpportunities, refetchInterval: 60_000 });
}
