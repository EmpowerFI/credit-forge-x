import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    : !investor ? "Only an investor account allocates."
    : cents < 10_000 ? "The smallest allocation is R$ 100."
    : cents > remaining + 100 ? `Only ${money(remaining)} is left to fund.`
    : null;

  return (
    <Panel title="Invest · Domestic P2P" actions={<StatusPill tone="caution">Simulated</StatusPill>}>
      {!open ? (
        <p className="text-sm text-muted-foreground">
          {row.funding_status === "funded" ? "Fully funded — EmpowerFI's P2P desk formalises and disburses next." : "Closed to new investment."}
        </p>
      ) : allocate.isSuccess ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-positive"><Check size={16} /> {money(cents)} allocated, simulated.</p>
          <p className="text-xs text-muted-foreground">Recorded and queued to be proven on Solana, like every allocation. No reais moved.</p>
          <Button className="w-full" onClick={() => navigate(`/app/investor/positions/${allocate.data.id}`)}>View your position</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Brazilian investors fund this one in reais; she receives it by Pix. Here the domestic pool is simulated: no bank transfer
            and no wallet are involved.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="brl-amount">Amount in reais</Label>
            <Input id="brl-amount" type="number" inputMode="decimal" min={100} step="50" value={reais} onChange={(e) => setReais(e.target.value)} />
            <p className="num text-xs text-muted-foreground">{money(remaining)} left to fund</p>
          </div>
          {problem && <p className="text-sm text-caution">{problem}</p>}
          {allocate.isError && <p className="text-sm text-alert">{describeError(allocate.error)}</p>}
          <Button className="h-11 w-full gap-2 text-base font-semibold" disabled={Boolean(problem) || allocate.isPending} onClick={() => allocate.mutate()}>
            {allocate.isPending ? <Loader2 size={18} className="animate-spin" /> : <Landmark size={18} />} Simulate a BRL allocation
          </Button>
        </div>
      )}
    </Panel>
  );
}
