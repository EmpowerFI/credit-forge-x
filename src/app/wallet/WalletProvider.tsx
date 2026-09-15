import type { ReactNode } from "react";
import { SelectedWalletAccountContextProvider } from "@solana/react";
import type { UiWallet } from "@wallet-standard/react";
import { CLUSTER } from "../lib/solana";

const STORAGE_KEY = "empowerfi:wallet-account";

// Remembered per browser, never required: storage may be unavailable.
const stateSync = {
  getSelectedWallet: () => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  },
  storeSelectedWallet: (key: string) => {
    try { localStorage.setItem(STORAGE_KEY, key); } catch { /* not remembered */ }
  },
  deleteSelectedWallet: () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to forget */ }
  },
};

/** Wallets that can work here: on devnet, able to sign a message and to sign and send a transaction. */
const usable = (wallet: UiWallet) =>
  wallet.chains.includes(CLUSTER) &&
  wallet.features.includes("solana:signMessage") &&
  wallet.features.includes("solana:signAndSendTransaction");

export default function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <SelectedWalletAccountContextProvider filterWallets={usable} stateSync={stateSync}>
      {children}
    </SelectedWalletAccountContextProvider>
  );
}
