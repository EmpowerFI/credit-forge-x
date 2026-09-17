import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useSelectedWalletAccount } from "@solana/react";
import { type UiWallet, type UiWalletAccount, useConnect } from "@wallet-standard/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "../auth/useAuth";
import { describeError } from "../lib/errors";
import { CLUSTER } from "../lib/solana";
import { tr } from "../i18n";

const INSTALL = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/download" },
];

function WalletOption({ wallet, onConnected, onError }: {
  wallet: UiWallet;
  onConnected: (account: UiWalletAccount) => void;
  onError: (message: string) => void;
}) {
  const [isConnecting, connect] = useConnect(wallet);
  return (
    <button type="button" disabled={isConnecting}
      onClick={async () => {
        try {
          const accounts = await connect();
          const account = accounts.find((a) => a.chains.includes(CLUSTER)) ?? accounts[0];
          if (!account) throw new Error(tr({ en: "The wallet did not share an account.", pt: "A carteira não compartilhou uma conta." }));
          onConnected(account);
        } catch (err) {
          onError(describeError(err));
        }
      }}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-left transition-colors hover:bg-secondary">
      {wallet.icon ? <img src={wallet.icon} alt="" className="h-7 w-7 rounded-md" /> : <span className="h-7 w-7 rounded-md bg-muted" />}
      <span className="flex-1 font-medium text-foreground">{wallet.name}</span>
      {isConnecting && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
    </button>
  );
}

/** Pick a wallet and connect it; the caller decides what happens next. */
export default function ConnectWalletDialog({ open, onOpenChange, onConnected }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (account: UiWalletAccount) => void;
}) {
  const [, setSelected, wallets] = useSelectedWalletAccount();
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  return (
    <Dialog open={open} onOpenChange={(o) => { setError(null); onOpenChange(o); }}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-heading">{tr({ en: "Connect a wallet", pt: "Conectar uma carteira" })}</DialogTitle>
          <DialogDescription>
            {tr({
              en: "Solana devnet only: test tokens with no real value. Signing in signs a message — no transaction, no fee.",
              pt: "Somente Solana devnet: tokens de teste, sem valor real. Para entrar, você assina uma mensagem — sem transação, sem taxa.",
            })}
          </DialogDescription>
        </DialogHeader>
        {wallets.length > 0 ? (
          <div className="space-y-2">
            {wallets.map((w) => (
              <WalletOption key={w.name} wallet={w} onError={setError}
                onConnected={(account) => { setSelected(account); onConnected(account); }} />
            ))}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {tr({
                en: "No Solana wallet found in this browser. Install one, switch it to devnet, and come back:",
                pt: "Nenhuma carteira Solana encontrada neste navegador. Instale uma, mude para a devnet e volte:",
              })}
            </p>
            <ul className="flex flex-wrap gap-2">
              {INSTALL.map((w) => (
                <li key={w.name}>
                  <a href={w.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-foreground hover:bg-secondary">
                    {w.name} <ExternalLink size={12} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              {session
                ? tr({
                  en: "Or close this and carry on as the demo investor: nothing changes until you connect.",
                  pt: "Ou feche isto e siga como o investidor de demonstração: nada muda até você conectar.",
                })
                : tr({
                  en: "Or explore the console as the demo investor, without a wallet.",
                  pt: "Ou explore o console como o investidor de demonstração, sem carteira.",
                })}
            </p>
          </div>
        )}
        {error && <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
