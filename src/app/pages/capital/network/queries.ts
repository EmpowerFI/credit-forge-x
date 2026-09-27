import { useQuery } from "@tanstack/react-query";
import {
  fetchDecisions, fetchInstruments, fetchProviders, decisionsKey, instrumentsKey, providersKey,
} from "../../../lib/capitalNetwork";

/** The providers behind the network, as the caller may see them. */
export function useProviders() {
  return useQuery({ queryKey: providersKey, queryFn: fetchProviders, staleTime: 60_000 });
}

/** Every instrument and the policy it is offered under. */
export function useInstruments() {
  return useQuery({ queryKey: instrumentsKey, queryFn: fetchInstruments, staleTime: 60_000 });
}

/** The runs recorded against one opportunity, newest first. */
export function useDecisions(opportunityId: string | null) {
  return useQuery({
    queryKey: decisionsKey(opportunityId ?? "none"),
    queryFn: () => fetchDecisions(opportunityId!),
    enabled: Boolean(opportunityId),
  });
}
