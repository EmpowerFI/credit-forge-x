import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr } from "../../i18n";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { useAuth } from "../../auth/useAuth";
import { positionReais } from "../../lib/capital";
import { describeError } from "../../lib/errors";
import type { MarketRow } from "../../lib/investor";
import { platform } from "../../lib/platform";
import { money } from "../../lib/readiness";

/**
 * A domestic opportunity is funded by Brazilian investors in reais. In this
 * prototype that pool is simulated: no bank transfer, no Pix, no wallet — an
 * allocation recorded and proven, and labelled SIMULATED wherever it shows.
 */
export default function DomesticInvest({ row }: { row: MarketRow }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remainingMicro = Math.max(0, (row.funding_target_micro_usdc ?? 0) - row.funded_micro_usdc);
  const remaining = positionReais(null, remainingMicro, row.fx_brl_per_usdc_milli) ?? 0;
  const [reais, setReais] = useState("500");
  const cents = Math.round(Number(reais || 0) * 100);
  const open = row.funding_status === "open" || row.funding_status === "partially_funded";
  const investor = profile?.role === "capital_provider";

  const allocate = useMutation({
    mutationFn: async () => {
      const { data, error } = await platform.rpc("allocate_domestic", { p_opportunity_id: row.opportunity_id, p_amount_cents: cents });
      if (error) throw error;
      return data as unknown as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform"] }),
  });

  const problem =
    !open ? null
    : !investor ? tr({ en: "Only an investor account allocates.", pt: "Só uma conta de investidor pode alocar." })
    : cents < 10_000 ? tr({ en: "The smallest allocation is R$ 100.", pt: "A alocação mínima é de R$ 100." })
    : cents > remaining + 100 ? tr({ en: `Only ${money(remaining)} is left to fund.`, pt: `Faltam só ${money(remaining)} para captar.` })
    : null;

  return (
    <Panel title={tr({ en: "Invest · Domestic P2P", pt: "Investir · P2P Doméstico" })}
      actions={<StatusPill tone="caution">{tr({ en: "Simulated", pt: "Simulado" })}</StatusPill>}>
      {!open ? (
        <p className="text-sm text-muted-foreground">
          {row.funding_status === "funded"
            ? tr({ en: "Fully funded — EmpowerFI's P2P desk formalises and disburses next.", pt: "100% captada. Agora a mesa P2P da EmpowerFI formaliza e desembolsa." })
            : tr({ en: "Closed to new investment.", pt: "Fechada para novos investimentos." })}
        </p>
      ) : allocate.isSuccess ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-positive"><Check size={16} /> {tr({ en: `${money(cents)} allocated, simulated.`, pt: `${money(cents)} alocados, de forma simulada.` })}</p>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "Recorded and queued to be proven on Solana, like every allocation. No reais moved.",
              pt: "Registrada e na fila para ser provada na Solana, como toda alocação. Nenhum real foi movimentado.",
            })}
          </p>
          <Button className="w-full" onClick={() => navigate(`/app/investor/positions/${allocate.data.id}`)}>{tr({ en: "View your position", pt: "Ver sua posição" })}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "Brazilian investors fund this one in reais; she receives it by Pix. Here the domestic pool is simulated: no bank transfer and no wallet are involved.",
              pt: "Investidores brasileiros financiam esta em reais; ela recebe por Pix. Aqui o pool doméstico é simulado: não há transferência bancária nem carteira.",
            })}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="brl-amount">{tr({ en: "Amount in reais", pt: "Valor em reais" })}</Label>
            <Input id="brl-amount" type="number" inputMode="decimal" min={100} step="50" value={reais} onChange={(e) => setReais(e.target.value)} />
            <p className="num text-xs text-muted-foreground">{tr({ en: `${money(remaining)} left to fund`, pt: `Faltam ${money(remaining)} para captar` })}</p>
          </div>
          {problem && <p className="text-sm text-caution">{problem}</p>}
          {allocate.isError && <p className="text-sm text-alert">{describeError(allocate.error)}</p>}
          <Button className="h-11 w-full gap-2 text-base font-semibold" disabled={Boolean(problem) || allocate.isPending} onClick={() => allocate.mutate()}>
            {allocate.isPending ? <Loader2 size={18} className="animate-spin" /> : <Landmark size={18} />} {tr({ en: "Simulate a BRL allocation", pt: "Simular uma alocação em reais" })}
          </Button>
        </div>
      )}
    </Panel>
  );
}
