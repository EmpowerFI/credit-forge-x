import { useQuery } from "@tanstack/react-query";
import { fetchJourney, fetchJourneyOpportunities, journeyKey, journeyOpportunitiesKey } from "../../../lib/capitalJourney";

/** The nine stages, over the whole book or over one request. */
export function useJourney(opportunityId: string | null) {
  return useQuery({
    queryKey: journeyKey(opportunityId),
    queryFn: () => fetchJourney(opportunityId),
    staleTime: 15_000,
  });
}

/** What the picker offers: every qualified request, the ones that travelled
 * furthest first. Not the desk's pipeline, which leaves out everything that
 * became a loan — that is, everything with a journey to follow. */
export function useJourneyOpportunities() {
  return useQuery({
    queryKey: journeyOpportunitiesKey,
    queryFn: fetchJourneyOpportunities,
    staleTime: 60_000,
  });
}
