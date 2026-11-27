import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
  SolanaMobileWalletAdapterWalletName,
} from "@solana-mobile/wallet-standard-mobile";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { diaryDb } from "../diary/db";

// The wallet on her phone, through Mobile Wallet Adapter (Seeker only). The
// webshell hands MWA's intents to the wallet app (Seed Vault on a Seeker,
// Phantom or Solflare elsewhere); she signs a message, never a transaction.

const CHAIN = "solana:devnet";
let registered = false;

/** Makes MWA one of the page's wallets. Once, when the Seeker app loads. */
export function registerPhoneWallet() {
  if (registered) return;
  registered = true;
  registerMwa({
    appIdentity: { name: "EmpowerFI", uri: window.location.origin, icon: "/app/diario-icons/icon-192.png" },
    authorizationCache: createDefaultAuthorizationCache(),
    chains: [CHAIN],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
}

type Signer = Wallet & { features: StandardConnectFeature & SolanaSignMessageFeature };

const canSign = (w: Wallet): w is Signer => StandardConnect in w.features && SolanaSignMessage in w.features;

/** MWA first (the phone's wallet app); any other wallet that signs messages, as on a desktop browser. */
export function phoneWallet(): Signer | null {
  const all = getWallets().get().filter(canSign);
  return all.find((w) => w.name === SolanaMobileWalletAdapterWalletName) ?? all[0] ?? null;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export class WalletStepError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function seekerWallet<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await diaryDb.functions.invoke<T>("seeker-wallet", { body });
  if (error) {
    let code = "unavailable";
    try {
      code = ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? code;
    } catch {
      // no body: keep "unavailable"
    }
    throw new WalletStepError(code);
  }
  return data as T;
}

export type PayoutAsked = "requested" | "no_reward_yet" | "payout_in_flight" | "failed";

/**
 * Connect, ask the server for the message, sign it, send the signature back.
 * The server checks it and records the wallet as hers.
 */
export async function connectPhoneWallet(): Promise<{ address: string; payout: PayoutAsked }> {
  const wallet = phoneWallet();
  if (!wallet) throw new WalletStepError("no_wallet");
  const { accounts } = await wallet.features[StandardConnect].connect();
  const account: WalletAccount | undefined = accounts.find((a) => a.chains.includes(CHAIN)) ?? accounts[0];
  if (!account) throw new WalletStepError("no_account");
  const { message } = await seekerWallet<{ message: string }>({ action: "challenge", address: account.address });
  const [signed] = await wallet.features[SolanaSignMessage].signMessage({ account, message: new TextEncoder().encode(message) });
  if (!signed) throw new WalletStepError("not_signed");
  return await seekerWallet<{ address: string; payout: PayoutAsked }>({ action: "verify", signature: toBase64(signed.signature) });
}
