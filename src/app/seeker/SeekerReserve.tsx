import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, PiggyBank, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import { diaryDb } from "../diary/db";
import { diary, PROFILE_KEY } from "../diary/diary";

// The Seeker's reserve (migration 20270117000000; strategy of 27/11/2026,
// "Modo Guardar", stage 1): she keeps her reward or sends it to the wallet on
// her phone. Kept, it stays in her reward wallet on devnet; it earns nothing,
// and the app shows a simulation of a remunerated reserve with the 90/10
// split, said to be a simulation.

interface Reserve {
  choice: "keep" | "send" | null;
  decimals: number;
  paid_units: number;
  balance_units: number;
  sending: boolean;
  simulation: { rate_bps: number; her_share_bps: number };
  entries: { kind: "in" | "out"; amount_units: number; campaign?: string; destination?: string; at: string; signature: string }[];
}

const RESERVE_KEY = [...PROFILE_KEY, "seeker-reserve"] as const;

const usdc = (units: number, decimals = 6, digits = 2) =>
  `${(units / 10 ** decimals).toLocaleString(tr({ en: "en-GB", pt: "pt-BR" }), { minimumFractionDigits: digits, maximumFractionDigits: digits })} USDC`;
const reais = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (iso: string) => new Date(iso).toLocaleDateString(tr({ en: "en-GB", pt: "pt-BR" }), { day: "2-digit", month: "2-digit" });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

async function reserve(): Promise<Reserve> {
  const { data, error } = await diaryDb.rpc("seeker_reserve" as never);
  if (error) throw error;
  return data as Reserve;
}

export function SeekerReserve() {
  const queryClient = useQueryClient();
  // Sending needs a destination: the phone's wallet, connected below.
  const rewards = useQuery({ queryKey: [...PROFILE_KEY, "rewards"], queryFn: diary.rewards });
  const hasWallet = Boolean(rewards.data?.destination);
  const query = useQuery({
    queryKey: RESERVE_KEY,
    queryFn: reserve,
    refetchInterval: (q) => (q.state.data?.sending ? 5_000 : false),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On opening: if she chose to send and it can go now, it goes.
  useEffect(() => {
    void (async () => {
      const { data } = await diaryDb.rpc("seeker_send_mine" as never);
      if (data === true) {
        await diary.runPayout();
        void queryClient.invalidateQueries({ queryKey: RESERVE_KEY });
      }
    })();
  }, [queryClient]);

  const choose = async (choice: "keep" | "send") => {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await diaryDb.rpc("seeker_reward_choose" as never, { p_choice: choice } as never);
    setBusy(false);
    if (rpcError) {
      setError(tr({ en: "It was not saved. Try again.", pt: "Não foi salvo. Tente de novo." }));
      return;
    }
    queryClient.setQueryData(RESERVE_KEY, data as Reserve);
    if ((data as Reserve).sending) await diary.runPayout();
    void queryClient.invalidateQueries({ queryKey: [...PROFILE_KEY, "rewards"] });
  };

  const r = query.data;
  if (query.isLoading) {
    return (
      <section className="flex min-h-32 items-center justify-center rounded-lg border border-border bg-card">
        <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
      </section>
    );
  }
  if (!r || r.paid_units === 0) return null;

  const balance = r.balance_units / 10 ** r.decimals;
  const yearly = (v: number) => v * (r.simulation.rate_bps / 10_000);
  const hers = (v: number) => yearly(v) * (r.simulation.her_share_bps / 10_000);
  const house = (v: number) => yearly(v) - hers(v);

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-labelledby="seeker-reserve-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="seeker-reserve-title" className="flex items-center gap-2 font-semibold">
          <PiggyBank size={18} aria-hidden="true" /> {tr({ en: "Your reserve", pt: "Sua reserva" })}
        </h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tr({ en: "Prototype · devnet", pt: "Protótipo · devnet" })}</span>
      </div>

      <div>
        <p className="font-heading text-3xl tabular-nums">{usdc(r.balance_units, r.decimals)}</p>
        <p className="text-sm text-muted-foreground">
          {r.sending
            ? tr({ en: "On its way to your wallet…", pt: "A caminho da sua carteira…" })
            : r.choice === "keep"
              ? tr({ en: "Kept in your reserve", pt: "Guardado na sua reserva" })
              : tr({ en: "Your rewards so far", pt: "Suas recompensas até agora" })}
        </p>
      </div>

      {r.choice === null ? (
        <div className="space-y-3">
          <p className="text-sm">
            {tr({
              en: "Your reward arrived. Keep it as your reserve, or send it to the wallet on your phone. You can change your mind at any time, and sending is always yours to choose.",
              pt: "Sua recompensa chegou. Guarde como reserva ou mande para a carteira do seu celular. Você pode mudar de ideia quando quiser, e sacar é sempre uma escolha sua.",
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button className="h-12 gap-2" disabled={busy} onClick={() => void choose("keep")}>
              <PiggyBank size={18} aria-hidden="true" />{tr({ en: "Keep", pt: "Guardar" })}
            </Button>
            <Button variant="outline" className="h-12 gap-2" disabled={busy || !hasWallet} onClick={() => void choose("send")}>
              <Send size={18} aria-hidden="true" />{tr({ en: "Send to me", pt: "Sacar" })}
            </Button>
          </div>
          {!hasWallet && (
            <p className="text-xs text-muted-foreground">{tr({ en: "To send, connect your wallet below first.", pt: "Para sacar, conecte sua carteira aqui embaixo primeiro." })}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 p-3 text-sm">
          <span>
            {r.choice === "keep"
              ? tr({ en: "New rewards stay in your reserve.", pt: "As próximas recompensas ficam na sua reserva." })
              : tr({ en: "Each reward goes to your wallet by itself.", pt: "Cada recompensa vai sozinha para a sua carteira." })}
          </span>
          <Button variant="outline" size="sm" className="h-10 shrink-0" disabled={busy || (r.choice === "keep" && !hasWallet)}
            onClick={() => void choose(r.choice === "keep" ? "send" : "keep")}>
            {r.choice === "keep" ? tr({ en: "Send to me", pt: "Sacar" }) : tr({ en: "Keep instead", pt: "Guardar" })}
          </Button>
        </div>
      )}

      {r.choice === "keep" && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-sm">
          <p className="font-medium">{tr({ en: "If your reserve earned 12% a year", pt: "Se sua reserva rendesse 12% ao ano" })}</p>
          <p className="text-muted-foreground">
            {tr({
              en: `Your ${usdc(r.balance_units, r.decimals)} in 12 months: ${usdc(hers(balance) * 10 ** r.decimals, r.decimals, 4)} for you, ${usdc(house(balance) * 10 ** r.decimals, r.decimals, 4)} for EmpowerFI.`,
              pt: `Seus ${usdc(r.balance_units, r.decimals)} em 12 meses: ${usdc(hers(balance) * 10 ** r.decimals, r.decimals, 4)} para você, ${usdc(house(balance) * 10 ** r.decimals, r.decimals, 4)} para a EmpowerFI.`,
            })}
          </p>
          <p className="text-muted-foreground">
            {tr({
              en: `With ${reais(1000)} kept: ${reais(hers(1000))} for you, ${reais(house(1000))} for EmpowerFI. You keep 90% of what it earns; EmpowerFI takes 10% only of a positive yield, never of what you put in.`,
              pt: `Com ${reais(1000)} guardados: ${reais(hers(1000))} para você, ${reais(house(1000))} para a EmpowerFI. Você fica com 90% do que render; a EmpowerFI só ganha 10% de rendimento positivo, nunca do que você guardou.`,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "A simulation, not a promise of return: this prototype runs on devnet with test tokens and earns nothing.",
              pt: "Simulação, não é promessa de retorno: este protótipo roda na devnet, com tokens de teste, e não rende nada.",
            })}
          </p>
        </div>
      )}

      {r.entries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{tr({ en: "Statement", pt: "Extrato" })}</h3>
          <ul className="divide-y divide-border text-sm">
            {r.entries.map((e) => (
              <li key={e.signature} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  {e.kind === "in"
                    ? <ArrowDownLeft size={16} className="shrink-0 text-primary" aria-hidden="true" />
                    : <ArrowUpRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span className="truncate">
                    {e.kind === "in"
                      ? tr({ en: `Reward · ${e.campaign}`, pt: `Recompensa · ${e.campaign}` })
                      : tr({ en: `To your wallet ${short(e.destination ?? "")}`, pt: `Para sua carteira ${short(e.destination ?? "")}` })}
                  </span>
                </span>
                <a href={explorer(e.signature)} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 tabular-nums underline-offset-4 hover:underline">
                  {e.kind === "in" ? "+" : "−"}{usdc(e.amount_units, r.decimals)} · {day(e.at)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
