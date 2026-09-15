import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { useSelectedWalletAccount } from "@solana/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "../auth/useAuth";
import { explorerAddress } from "../lib/platform";
import { FAUCETS, shortAddress, sol, usdc } from "../lib/solana";
import ConnectWalletDialog from "./ConnectWallet";
import { useBalances } from "./useBalances";

/** The investor's wallet in the top bar: address, balances, faucets. */
export default function WalletChip() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useSelectedWalletAccount();
  const [connecting, setConnecting] = useState(false);
  const wallet = profile?.wallet_address ?? null;
  const connected = account && wallet && account.address === wallet;
  const balances = useBalances(connected ? wallet : null);

  if (profile?.role !== "capital_provider") return null;

  if (!wallet) {
    return (
      <Button size="sm" variant="secondary" className="gap-2"
        onClick={async () => { await signOut(); navigate("/app/login"); }}
        title="You are exploring as the demo investor. Sign in with your own wallet to invest.">
        <Wallet size={15} /> <span className="hidden sm:inline">Demo · use your wallet</span>
      </Button>
    );
  }

  if (!connected) {
    return (
      <>
        <Button size="sm" variant="secondary" className="gap-2" onClick={() => setConnecting(true)}>
          <Wallet size={15} /> <span className="hidden sm:inline">Reconnect {shortAddress(wallet)}</span>
        </Button>
        <ConnectWalletDialog open={connecting} onOpenChange={setConnecting}
          onConnected={(a) => {
            setConnecting(false);
            if (a.address !== wallet) toast.error(`That wallet is ${shortAddress(a.address)}; you signed in as ${shortAddress(wallet)}.`);
          }} />
      </>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" className="num gap-2">
          <Wallet size={15} />
          <span className="hidden font-mono text-xs sm:inline">{shortAddress(wallet)}</span>
          <span className="text-xs">{balances.data ? usdc(balances.data.microUsdc) : "…"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4 border-border bg-card">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Wallet · Solana Devnet</p>
          <button className="text-muted-foreground hover:text-foreground" onClick={() => balances.refetch()} aria-label="Refresh balances">
            <RefreshCw size={14} className={balances.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <a href={explorerAddress(wallet)} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-info hover:underline">
            {shortAddress(wallet)}
          </a>
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { void navigator.clipboard?.writeText(wallet); toast.success("Address copied"); }}>
            <Copy size={12} /> Copy
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">SOL · fees</p>
            <p className="num font-heading text-lg font-bold text-foreground">{balances.data ? sol(balances.data.lamports) : "…"}</p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">USDC · to invest</p>
            <p className="num font-heading text-lg font-bold text-foreground">{balances.data ? usdc(balances.data.microUsdc) : "…"}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">Test tokens, no real value. Copy your address into a faucet:</p>
          <div className="flex flex-wrap gap-2">
            <a href={FAUCETS.sol} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-secondary">
              Get test SOL <ExternalLink size={12} aria-hidden />
            </a>
            <a href={FAUCETS.usdc} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-secondary">
              Get test USDC <ExternalLink size={12} aria-hidden />
            </a>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setAccount(undefined)}>Disconnect wallet</Button>
      </PopoverContent>
    </Popover>
  );
}
