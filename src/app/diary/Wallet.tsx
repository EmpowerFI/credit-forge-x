import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr } from "../i18n";
import { diary, diaryErrorText, type DiaryRewards, PROFILE_KEY } from "./diary";

const REWARDS_KEY = [...PROFILE_KEY, "rewards"] as const;
/** Where her rewards go. Until the partner's integration exists, she gives the address on devnet herself. */
const PARTNER = "conta.vc";

/** 5000000 units of a 6-decimal mint: "5,00 USDC". */
function usdc(units: number, decimals = 6): string {
  const value = units / 10 ** decimals;
  return `${value.toLocaleString(tr({ en: "en-GB", pt: "pt-BR" }), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString(tr({ en: "en-GB", pt: "pt-BR" }), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * On Today: her rewards so far and, with one button, sending them to her
 * account at the partner (20270104). Shown once something was paid into her
 * wallet. On devnet, with test tokens; she connects her account by giving its
 * address, and a new account waits a day before it receives anything.
 */
export function RewardsWallet() {
  const queryClient = useQueryClient();
  const rewards = useQuery({
    queryKey: REWARDS_KEY,
    queryFn: diary.rewards,
    // While a transfer is on its way, look again until it lands.
    refetchInterval: (q) => (q.state.data?.in_flight ? 5_000 : false),
  });
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const r = rewards.data;
  if (!r || (r.paid_units === 0 && !r.destination && !r.in_flight)) return null;

  const act = async (run: () => Promise<DiaryRewards>) => {
    setBusy(true);
    setError(null);
    try {
      queryClient.setQueryData(REWARDS_KEY, await run());
      setConnecting(false);
      setAddress("");
      await diary.runPayout();
    } catch (e) {
      setError(diaryErrorText(e));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: REWARDS_KEY });
    }
  };

  const activeFrom = r.destination_active_from ? new Date(r.destination_active_from) : null;
  const waiting = activeFrom !== null && activeFrom > new Date();
  const ready = Boolean(r.destination) && activeFrom !== null && !waiting;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-labelledby="rewards-title" aria-busy={busy || Boolean(r.in_flight)}>
      <div className="flex items-start justify-between gap-3">
        <h2 id="rewards-title" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <WalletIcon size={18} className="text-primary" aria-hidden="true" />
          {tr({ en: "Your rewards", pt: "Suas recompensas" })}
        </h2>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {tr({ en: "Test · devnet", pt: "Teste · devnet" })}
        </span>
      </div>

      <div>
        <p className="font-heading text-2xl font-semibold tabular-nums">{usdc(r.balance_units, r.decimals)}</p>
        <p className="text-xs text-muted-foreground">
          {r.withdrawn_units > 0
            ? tr({
              en: `Received so far: ${usdc(r.paid_units, r.decimals)} · transferred: ${usdc(r.withdrawn_units, r.decimals)}`,
              pt: `Recebido até agora: ${usdc(r.paid_units, r.decimals)} · transferido: ${usdc(r.withdrawn_units, r.decimals)}`,
            })
            : tr({ en: "In your rewards wallet", pt: "Na sua carteira de recompensas" })}
        </p>
      </div>

      {r.in_flight ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {r.in_flight.kind === "set_payout"
            ? tr({ en: `Connecting your ${PARTNER} account…`, pt: `Conectando sua conta ${PARTNER}…` })
            : tr({ en: `Transferring to your ${PARTNER} account…`, pt: `Transferindo para sua conta ${PARTNER}…` })}
        </p>
      ) : connecting || !r.destination ? (
        connecting ? (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void act(() => diary.setPayout(address)); }}>
            <Label htmlFor="payout-address">{tr({ en: `Your ${PARTNER} account address`, pt: `Endereço da sua conta ${PARTNER}` })}</Label>
            <Input id="payout-address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" spellCheck={false}
              inputMode="text" className="h-11 font-mono text-sm" placeholder="9xQe…VFin" required />
            <p className="text-xs text-muted-foreground">
              {tr({
                en: `While the link with ${PARTNER} is being built, paste the address of a devnet wallet. For your safety, a new account receives transfers 24 hours after it is connected.`,
                pt: `Enquanto a ligação com o ${PARTNER} fica pronta, cole o endereço de uma carteira na devnet. Por segurança, uma conta nova recebe transferências 24 horas depois de conectada.`,
              })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => { setConnecting(false); setError(null); }}>
                {tr({ en: "Cancel", pt: "Cancelar" })}
              </Button>
              <Button type="submit" className="h-11" disabled={busy || !address.trim()}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : tr({ en: "Connect", pt: "Conectar" })}
              </Button>
            </div>
          </form>
        ) : (
          <Button className="h-11 w-full" disabled={busy || r.balance_units === 0} onClick={() => setConnecting(true)}>
            {tr({ en: `Transfer to ${PARTNER}`, pt: `Transferir para o ${PARTNER}` })} <ArrowUpRight aria-hidden="true" />
          </Button>
        )
      ) : (
        <div className="space-y-2">
          {r.balance_units > 0 && (
            <Button className="h-11 w-full" disabled={busy || !ready} onClick={() => void act(diary.withdrawReward)}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <>{tr({ en: `Transfer to ${PARTNER}`, pt: `Transferir para o ${PARTNER}` })} <ArrowUpRight aria-hidden="true" /></>}
            </Button>
          )}
          {waiting && activeFrom && (
            <p className="flex gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {tr({
                en: `Account connected. For your safety, transfers open on ${when(activeFrom.toISOString())}.`,
                pt: `Conta conectada. Por segurança, as transferências liberam em ${when(activeFrom.toISOString())}.`,
              })}
            </p>
          )}
          {ready && r.balance_units === 0 && (
            <p className="text-xs text-muted-foreground">{tr({ en: "Nothing to transfer right now.", pt: "Nada para transferir agora." })}</p>
          )}
          <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{tr({ en: `Account: ${short(r.destination)}`, pt: `Conta: ${short(r.destination)}` })}</span>
            <button type="button" onClick={() => setConnecting(true)}
              className="min-h-10 rounded px-2 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {tr({ en: "Change", pt: "Trocar" })}
            </button>
          </p>
        </div>
      )}

      {r.last_failed && !r.in_flight && (
        <p className="text-xs text-muted-foreground">
          {tr({ en: "The last attempt did not go through. You can try again.", pt: "A última tentativa não deu certo. Você pode tentar de novo." })}
        </p>
      )}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

      {r.withdrawals.length > 0 && (
        <details className="text-sm">
          <summary className="flex min-h-10 cursor-pointer items-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {tr({ en: "Transfers made", pt: "Transferências feitas" })}
          </summary>
          <ul className="space-y-1 pt-1">
            {r.withdrawals.map((w) => (
              <li key={w.signature} className="flex justify-between gap-3">
                <a href={`https://explorer.solana.com/tx/${w.signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                  className="underline underline-offset-2">{when(w.confirmed_at)}</a>
                <span className="tabular-nums">{usdc(w.amount_units, r.decimals)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
