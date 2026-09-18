import { useQuery } from "@tanstack/react-query";
import { engineOpportunitiesKey, fetchEngineOpportunities } from "../../lib/engine";
import { fetchRouteCards, routeCardsKey } from "../../lib/settlementRoute";

/** The qualified opportunities the engine page selects from, as the caller may see them. */
export function useEngineOpportunities() {
  return useQuery({ queryKey: engineOpportunitiesKey, queryFn: fetchEngineOpportunities, refetchInterval: 60_000 });
}

/** The settlement rate cards, as the database holds them: they change with a migration, not with a run. */
export function useRouteCards() {
  return useQuery({ queryKey: routeCardsKey, queryFn: fetchRouteCards, staleTime: 5 * 60_000 });
}
