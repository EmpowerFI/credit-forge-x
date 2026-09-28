import { useQuery } from "@tanstack/react-query";
import { fetchJourney, journeyKey } from "../../../lib/capitalJourney";

/** The nine stages, over the whole book or over one request. */
export function useJourney(opportunityId: string | null) {
  return useQuery({
    queryKey: journeyKey(opportunityId),
    queryFn: () => fetchJourney(opportunityId),
    staleTime: 15_000,
  });
}
