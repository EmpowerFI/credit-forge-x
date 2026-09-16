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
import { tr } from "../i18n";

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
        title={tr({
          en: "You are exploring as the demo investor. Sign in with your own wallet to invest.",
          pt: "Você está explorando como o investidor de demonstração. Entre com a sua carteira para investir.",
        })}>
        <Wallet size={15} /> <span className="hidden sm:inline">{tr({ en: "Demo · use your wallet", pt: "Demo · use sua carteira" })}</span>
      </Button>
    );
  }

  if (!connected) {
    return (
      <>
        <Button size="sm" variant="secondary" className="gap-2" onClick={() => setConnecting(true)}>
          <Wallet size={15} /> <span className="hidden sm:inline">
            {tr({ en: `Reconnect ${shortAddress(wallet)}`, pt: `Reconectar ${shortAddress(wallet)}` })}
          </span>
        </Button>
        <ConnectWalletDialog open={connecting} onOpenChange={setConnecting}
          onConnected={(a) => {
            setConnecting(false);
            if (a.address !== wallet) toast.error(tr({
              en: `That wallet is ${shortAddress(a.address)}; you signed in as ${shortAddress(wallet)}.`,
              pt: `Essa carteira é ${shortAddress(a.address)}; você entrou como ${shortAddress(wallet)}.`,
            }));
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
          <p className="text-xs text-muted-foreground">{tr({ en: "Wallet · Solana Devnet", pt: "Carteira · Solana Devnet" })}</p>
          <button className="text-muted-foreground hover:text-foreground" onClick={() => balances.refetch()} aria-label={tr({ en: "Refresh balances", pt: "Atualizar saldos" })}>
            <RefreshCw size={14} className={balances.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <a href={explorerAddress(wallet)} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-info hover:underline">
            {shortAddress(wallet)}
          </a>
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { void navigator.clipboard?.writeText(wallet); toast.success(tr({ en: "Address copied", pt: "Endereço copiado" })); }}>
            <Copy size={12} /> {tr({ en: "Copy", pt: "Copiar" })}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">{tr({ en: "SOL · fees", pt: "SOL · taxas" })}</p>
            <p className="num font-heading text-lg font-bold text-foreground">{balances.data ? sol(balances.data.lamports) : "…"}</p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">{tr({ en: "USDC · to invest", pt: "USDC · para investir" })}</p>
            <p className="num font-heading text-lg font-bold text-foreground">{balances.data ? usdc(balances.data.microUsdc) : "…"}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "Test tokens, no real value. Copy your address into a faucet:",
              pt: "Tokens de teste, sem valor real. Cole seu endereço em um faucet:",
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={FAUCETS.sol} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-secondary">
              {tr({ en: "Get test SOL", pt: "Obter SOL de teste" })} <ExternalLink size={12} aria-hidden />
            </a>
            <a href={FAUCETS.usdc} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-secondary">
              {tr({ en: "Get test USDC", pt: "Obter USDC de teste" })} <ExternalLink size={12} aria-hidden />
            </a>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setAccount(undefined)}>
          {tr({ en: "Disconnect wallet", pt: "Desconectar carteira" })}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
