import { useQuery } from "@tanstack/react-query";
import type { Portfolio } from "../../lib/investor";
import { capitalOverviewKey, fetchCapitalOverview } from "../../lib/capital";
import { platform } from "../../lib/platform";

// The investor console's reads. Every one is scoped by the database to the
// caller: the market as an investor may see it, and the caller's own positions.

export function useMarket() {
  return useQuery({
    queryKey: ["platform", "investor-market"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("investor_opportunities");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: ["platform", "investor-portfolio"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("investor_portfolio");
      if (error) throw error;
      return data as unknown as Portfolio;
    },
  });
}

export function useActivity(limit = 50) {
  return useQuery({
    queryKey: ["platform", "investor-activity", limit],
    queryFn: async () => {
      const { data, error } = await platform.rpc("investor_activity", { p_limit: limit });
      if (error) throw error;
      return data;
    },
  });
}

export function useProofs() {
  return useQuery({
    queryKey: ["platform", "investor-proofs"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("investor_proofs");
      if (error) throw error;
      return data;
    },
  });
}

export function useCapitalOverview() {
  return useQuery({ queryKey: capitalOverviewKey, queryFn: fetchCapitalOverview, refetchInterval: 30_000 });
}
