import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import { diaryDb } from "../diary/db";
import { diary, diaryErrorText, PROFILE_KEY } from "../diary/diary";
import { connectPhoneWallet, registerPhoneWallet, WalletStepError } from "./wallet";

const REWARDS_KEY = [...PROFILE_KEY, "rewards"] as const;
const WALLET_KEY = [...PROFILE_KEY, "seeker-wallet"] as const;

interface SeekerWalletRow { address: string; auto_transfer: boolean; verified_at: string }

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString(tr({ en: "en-GB", pt: "pt-BR" }), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function stepError(e: unknown): string {
  const code = e instanceof WalletStepError ? e.code : "";
  switch (code) {
    case "no_wallet":
      return tr({ en: "No wallet app found. Install Solflare or Phantom and set it to devnet.", pt: "Nenhum app de carteira encontrado. Instale a Solflare ou a Phantom e coloque na devnet." });
    case "signature_invalid":
      return tr({ en: "The signature did not match this wallet. Try again.", pt: "A assinatura não confere com esta carteira. Tente de novo." });
    case "challenge_expired":
      return tr({ en: "It took more than five minutes. Try again.", pt: "Passou de cinco minutos. Tente de novo." });
    case "address_invalid":
      return tr({ en: "The wallet sent an address we cannot read.", pt: "A carteira mandou um endereço que não conseguimos ler." });
    default: {
      const text = e instanceof Error ? e.message : "";
      // A wallet the person closed or refused: no alarm, she can try again.
      if (/reject|cancel|declin|closed/i.test(text)) return tr({ en: "You cancelled in the wallet.", pt: "Você cancelou na carteira." });
      return diaryErrorText(e);
    }
  }
}

/**
 * The Seeker's wallet card: her rewards so far and the wallet on her phone,
 * connected by signing a message. Once connected, each reward goes on to it by
 * itself; the program waits 24 hours before a new wallet can receive.
 */
export function SeekerWallet() {
  const queryClient = useQueryClient();
  useEffect(() => registerPhoneWallet(), []);
  const rewards = useQuery({
    queryKey: REWARDS_KEY,
    queryFn: diary.rewards,
    refetchInterval: (q) => (q.state.data?.in_flight ? 5_000 : false),
  });
  const wallet = useQuery({
    queryKey: WALLET_KEY,
    queryFn: async () => {
      const { data, error } = await diaryDb.rpc("seeker_wallet_get" as never);
      if (error) throw error;
      return (data as SeekerWalletRow | null) ?? null;
    },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const done = await connectPhoneWallet();
      if (done.payout === "failed") setError(tr({ en: "The wallet is yours, but we could not set it to receive yet. Try again later.", pt: "A carteira é sua, mas ainda não conseguimos deixá-la pronta para receber. Tente mais tarde." }));
      await diary.runPayout();
    } catch (e) {
      setError(stepError(e));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: WALLET_KEY });
      void queryClient.invalidateQueries({ queryKey: REWARDS_KEY });
    }
  };

  if (rewards.isLoading || wallet.isLoading) {
    return (
      <section className="flex min-h-32 items-center justify-center rounded-lg border border-border bg-card">
        <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
      </section>
    );
  }

  const r = rewards.data;
  const w = wallet.data;
  const isDestination = Boolean(w && r?.destination === w.address);
  const activeFrom = isDestination && r?.destination_active_from ? new Date(r.destination_active_from) : null;
  const settingUp = Boolean(w && r?.in_flight?.kind === "set_payout" && r.in_flight.destination === w.address);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="seeker-wallet-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="seeker-wallet-title" className="font-semibold">{tr({ en: "Your wallet", pt: "Sua carteira" })}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tr({ en: "Test · devnet", pt: "Teste · devnet" })}</span>
      </div>

      {!w ? (
        <>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "Connect the wallet on your phone and your rewards go straight to it. You sign a message only: no transaction, no fee.",
              pt: "Conecte a carteira do seu celular e suas recompensas vão direto para ela. Você só assina uma mensagem: sem transação, sem taxa.",
            })}
          </p>
          <Button className="h-12 w-full gap-2" onClick={() => void connect()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />}
            {tr({ en: "Connect my wallet", pt: "Conectar minha carteira" })}
          </Button>
        </>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <Check size={16} className="text-primary" aria-hidden="true" />
            {tr({ en: "Wallet connected:", pt: "Carteira conectada:" })} <span className="font-mono">{short(w.address)}</span>
          </p>
          {settingUp ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {tr({ en: "Registering it on Solana…", pt: "Registrando na Solana…" })}
            </p>
          ) : activeFrom && activeFrom > new Date() ? (
            <p className="flex items-start gap-2 text-muted-foreground">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {tr({ en: `For your safety, it receives from ${when(activeFrom.toISOString())}.`, pt: `Por segurança, ela recebe a partir de ${when(activeFrom.toISOString())}.` })}
            </p>
          ) : activeFrom ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check size={16} aria-hidden="true" />
              {tr({ en: "Ready to receive what you send.", pt: "Pronta para receber o que você sacar." })}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-muted-foreground">
              <Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {tr({ en: "It starts receiving after your first reward.", pt: "Ela começa a receber depois da sua primeira recompensa." })}
            </p>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
