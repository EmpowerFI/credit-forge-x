import { useQuery } from "@tanstack/react-query";
import {
  dashboardKey, economiesKey, fetchLocalEconomies, fetchLocalEconomyDashboard,
} from "../../../lib/localEconomy";

/** The local economies this caller may open, oldest first. */
export function useLocalEconomies() {
  return useQuery({ queryKey: economiesKey, queryFn: fetchLocalEconomies, staleTime: 60_000 });
}

/** One economy's ledger, totalled. Null when no territory has a rail. */
export function useLocalEconomy(economyId: string | null) {
  return useQuery({
    queryKey: dashboardKey(economyId),
    queryFn: () => fetchLocalEconomyDashboard(economyId),
    staleTime: 15_000,
  });
}
