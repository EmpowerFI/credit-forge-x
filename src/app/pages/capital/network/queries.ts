import { useQuery } from "@tanstack/react-query";
import {
  capitalPlanKey, decisionsKey, fetchCapitalOrigin, fetchCapitalPlan, fetchDecisions, fetchInstruments,
  fetchProviders, instrumentsKey, originKey, providersKey,
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

/** The latest plan recorded for one opportunity, with the routes it names resolved. */
export function useCapitalPlan(opportunityId: string | null | undefined) {
  return useQuery({
    queryKey: capitalPlanKey(opportunityId ?? "none"),
    queryFn: () => fetchCapitalPlan(opportunityId!),
    enabled: Boolean(opportunityId),
  });
}

/** Where the capital came from, over every plan the network has recorded. */
export function useCapitalOrigin() {
  return useQuery({ queryKey: originKey, queryFn: fetchCapitalOrigin, staleTime: 30_000 });
}
