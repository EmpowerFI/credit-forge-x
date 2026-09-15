import { useCallback } from "react";
import { useSignMessage } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { platform } from "../lib/platform";

export const SIGN_IN_STATEMENT = "Sign in to the EmpowerFI investor console on Solana devnet. This signs a message only: no transaction, no fee.";

/**
 * Sign in with Solana: the wallet signs a message Supabase builds and checks.
 * A new wallet becomes a capital provider, known by its address.
 */
export function useWalletSignIn(account: UiWalletAccount) {
  const signMessage = useSignMessage(account);
  return useCallback(async () => {
    const { error } = await platform.auth.signInWithWeb3({
      chain: "solana",
      statement: SIGN_IN_STATEMENT,
      wallet: {
        publicKey: { toBase58: () => account.address },
        signMessage: async (message: Uint8Array) => (await signMessage({ message })).signature as Uint8Array,
      },
    });
    if (error) throw error;
  }, [account.address, signMessage]);
}
