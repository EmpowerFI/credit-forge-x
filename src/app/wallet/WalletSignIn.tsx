import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { describeError } from "../lib/errors";
import { shortAddress } from "../lib/solana";
import { tr } from "../i18n";
import ConnectWalletDialog from "./ConnectWallet";
import { supportsSolanaSignIn, useWalletSignInWithMessage, useWalletSignInWithSolana } from "./useWalletSignIn";

/**
 * After a wallet connects: one signature, and the investor is in. It opens as a
 * dialog in the middle of the screen and asks the wallet to sign straight away,
 * so the step can't be missed below the fold; if the wallet refuses or fails,
 * the reason and a retry stay in the same place.
 */
type WalletSignInProps = { account: UiWalletAccount; onDone: () => void; onCancel: () => void };

export default function WalletSignIn(props: WalletSignInProps) {
  return supportsSolanaSignIn(props.account) ? <SignInWithSolana {...props} /> : <SignInWithMessage {...props} />;
}

function SignInWithSolana(props: WalletSignInProps) {
  return <WalletSignInDialog {...props} signIn={useWalletSignInWithSolana(props.account)} />;
}

function SignInWithMessage(props: WalletSignInProps) {
  return <WalletSignInDialog {...props} signIn={useWalletSignInWithMessage(props.account)} />;
}

function WalletSignInDialog({ account, onDone, onCancel, signIn }: WalletSignInProps & { signIn: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const sign = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
      onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }, [signIn, onDone]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void sign();
  }, [sign]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {tr({ en: `Sign in with ${shortAddress(account.address)}`, pt: `Entrar com ${shortAddress(account.address)}` })}
          </DialogTitle>
          <DialogDescription>
            {tr({
              en: "Your wallet asks you to sign a message proving you hold this address. No transaction, no fee.",
              pt: "Sua carteira pede que você assine uma mensagem provando que controla este endereço. Sem transação, sem taxa.",
            })}
          </DialogDescription>
        </DialogHeader>
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 size={16} className="animate-spin" />
            {tr({ en: "Waiting for your wallet… check its window to approve.", pt: "Aguardando sua carteira… confira a janela dela para aprovar." })}
          </p>
        )}
        {error && <p className="rounded-lg border tone-alert p-3 text-sm" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} className="gap-2" onClick={() => void sign()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
            {error ? tr({ en: "Try again", pt: "Tentar de novo" }) : tr({ en: "Sign the message", pt: "Assinar a mensagem" })}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Connect a wallet and sign in with it without leaving the page. Whatever the
 * investor was reading — an opportunity, the console — is still there when the
 * signature comes back, now under her own address instead of the demo account.
 */
export function useWalletEntry(onDone?: () => void) {
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState<UiWalletAccount | null>(null);

  return {
    /** Open the wallet picker. */
    start: () => setConnecting(true),
    /** True from the wallet picker until the signature is in or cancelled. */
    busy: connecting || account !== null,
    dialogs: (
      <>
        <ConnectWalletDialog open={connecting} onOpenChange={setConnecting}
          onConnected={(a) => { setConnecting(false); setAccount(a); }} />
        {account && (
          <WalletSignIn account={account} onCancel={() => setAccount(null)}
            onDone={() => { setAccount(null); onDone?.(); }} />
        )}
      </>
    ),
  };
}
