import { useCallback } from "react";
import { useSignIn, useSignMessage } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { platform } from "../lib/platform";

export const SIGN_IN_STATEMENT = "Sign in to the EmpowerFI investor console on Solana devnet. This signs a message only: no transaction, no fee.";

/** Whether the wallet signs in with Solana itself (Phantom, Solflare, Backpack do). */
export const supportsSolanaSignIn = (account: UiWalletAccount) => account.features.includes("solana:signIn");

/**
 * A Sign In With Solana message, in the order the standard sets and wallets
 * check: URI, then Version, then Issued At. Supabase's own fallback puts Version
 * before URI, and Phantom refuses to show that ("invalid formatting").
 */
export function signInMessage(input: { domain: string; address: string; statement: string; uri: string; issuedAt: string }) {
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.address,
    "",
    input.statement,
    "",
    `URI: ${input.uri}`,
    "Version: 1",
    `Issued At: ${input.issuedAt}`,
  ].join("\n");
}

/**
 * Sign in with Solana through the wallet's own sign-in: the wallet writes the
 * message, shows it in its format, and Supabase checks it. A new wallet becomes
 * a capital provider, known by its address.
 */
export function useWalletSignInWithSolana(account: UiWalletAccount) {
  const signIn = useSignIn(account);
  return useCallback(async () => {
    const { error } = await platform.auth.signInWithWeb3({
      chain: "solana",
      statement: SIGN_IN_STATEMENT,
      wallet: {
        publicKey: { toBase58: () => account.address },
        signIn: async (input: Parameters<typeof signIn>[0]) => {
          const { signedMessage, signature } = await signIn(input);
          return { signedMessage: signedMessage as Uint8Array, signature: signature as Uint8Array };
        },
      } as never,
    });
    if (error) throw error;
  }, [account.address, signIn]);
}

/** For a wallet without its own sign-in: the same message, built here in the standard's order, then signed. */
export function useWalletSignInWithMessage(account: UiWalletAccount) {
  const signMessage = useSignMessage(account);
  return useCallback(async () => {
    const url = new URL(window.location.href);
    const message = signInMessage({
      domain: url.host,
      address: account.address,
      statement: SIGN_IN_STATEMENT,
      uri: url.href,
      issuedAt: new Date().toISOString(),
    });
    const { signature } = await signMessage({ message: new TextEncoder().encode(message) });
    const { error } = await platform.auth.signInWithWeb3({ chain: "solana", message, signature: signature as Uint8Array });
    if (error) throw error;
  }, [account.address, signMessage]);
}
