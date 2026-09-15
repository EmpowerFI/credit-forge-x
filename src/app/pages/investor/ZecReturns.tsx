import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { describeError } from "../../lib/errors";
import { usdc } from "../../lib/solana";
import {
  fetchZecReturns, isShieldedTestAddress, RETURN_LABEL, setReturnAddress, usdPerZec, zcashExplorerTx, zec, zecReturnsKey,
} from "../../lib/zcash";

/**
 * Where what comes back goes, for a position paid in shielded ZEC with no
 * Solana wallet: a shielded address of the investor's, and every instalment
 * share or refund the treasury has paid to it.
 */
export default function ZecReturns({ investmentId, owed, readOnly }: { investmentId: string; owed: boolean; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const returns = useQuery({ queryKey: zecReturnsKey(investmentId), queryFn: () => fetchZecReturns(investmentId), refetchInterval: 20_000 });
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: () => setReturnAddress({ investmentId }, address),
    onSuccess: () => {
      toast.success("Saved. What is owed to you is queued for the treasury to send.");
      setEditing(false);
      setAddress("");
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (e) => toast.error(describeError(e)),
  });

  if (returns.isError) return <Panel title="Returns in ZEC"><LoadError compact error={returns.error} onRetry={() => returns.refetch()} /></Panel>;
  const d = returns.data;
  const valid = isShieldedTestAddress(address);

  return (
    <Panel title="Returns in ZEC"
      description="You paid in shielded ZEC and have no Solana wallet here, so what comes back to you — each instalment's share, or a refund — is paid in shielded ZEC from EmpowerFI's treasury, at CoinGecko's quote when it is sent. The conversion from reais is simulated; the ZEC is real testnet ZEC.">
      {!d ? <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" /> : (
        <div className="space-y-4">
          {d.return_address && !editing ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Your return address</span>
                <span className="block truncate font-mono text-xs text-foreground" title={d.return_address}>
                  {d.return_address.slice(0, 14)}…{d.return_address.slice(-8)}
                </span>
              </span>
              {!readOnly && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Change</Button>}
            </div>
          ) : readOnly ? (
            <p className="text-sm text-muted-foreground">No return address yet.</p>
          ) : (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
              <Label htmlFor={`ret-${investmentId}`}>Shielded address for your returns</Label>
              <div className="flex flex-wrap gap-2">
                <Input id={`ret-${investmentId}`} className="min-w-0 flex-1 font-mono text-xs" placeholder="utest1… or ztestsapling1…"
                  value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" spellCheck={false} />
                <Button type="submit" disabled={!valid || save.isPending} className="gap-1.5">
                  {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Save
                </Button>
                {editing && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
              </div>
              <p className={`text-xs ${address && !valid ? "text-caution" : "text-muted-foreground"}`}>
                {address && !valid ? "A unified (utest1…) or Sapling (ztestsapling1…) testnet address: transparent addresses are not accepted."
                  : owed ? "Something is owed to you already: it is sent once you save." : "Only EmpowerFI's treasury key and its auditor can see payments to it."}
              </p>
            </form>
          )}

          {d.returns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{owed && !d.return_address ? "Held until you give an address." : "Nothing paid back yet."}</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.returns.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="text-foreground">{r.kind === "refund" ? "Refund" : `Instalment ${r.instalment_no ?? "—"}`}</span>
                    <span className="block text-xs text-muted-foreground">
                      {usdc(r.amount_micro_usdc)}{r.amount_zat ? ` → ${zec(r.amount_zat)} at ${usdPerZec(r.usd_per_zec_cents!)} per ZEC` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {r.txid && (
                      <a href={zcashExplorerTx(r.txid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
                        {r.txid.slice(0, 4)}…{r.txid.slice(-4)} <ExternalLink size={11} aria-hidden />
                      </a>
                    )}
                    <StatusPill tone={RETURN_LABEL[r.status].tone}>{RETURN_LABEL[r.status].label}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Sending ZEC needs the treasury's spending key, which never leaves EmpowerFI's operator: on testnet the operator sends what is owed in batches.
            On the explorer, a shielded payment shows only that a transaction happened.
          </p>
        </div>
      )}
    </Panel>
  );
}
