import { useQuery } from "@tanstack/react-query";
import type { Portfolio } from "../../lib/investor";
import { capitalOverviewKey, fetchCapitalOverview } from "../../lib/capital";
import { platform } from "../../lib/platform";
import { useAuth } from "../../auth/useAuth";

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

/** What this console does not carry: qualified demand raising in reais on the
 * domestic desk. A footnote for the market, so an investor who sees eight
 * requests can learn that the engine qualified ten. */
export function useMarketElsewhere() {
  return useQuery({
    queryKey: ["platform", "market-elsewhere"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("market_funded_elsewhere");
      if (error) throw error;
      return data as unknown as { count: number; amount_cents: number } | null;
    },
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

/** The investor's own mandate, if one is set. */
export function useMandate() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["platform", "investor-mandate", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await platform.from("investor_mandates").select("*").eq("investor_id", profile!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
