import { useQuery } from "@tanstack/react-query";
import { balancesOf } from "../lib/solana";

/** A wallet's SOL and USDC on devnet, kept fresh while the page is open. */
export function useBalances(address: string | null | undefined) {
  return useQuery({
    queryKey: ["solana", "balances", address],
    enabled: Boolean(address),
    queryFn: () => balancesOf(address!),
    refetchInterval: 20_000,
  });
}
