import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import { CrossingOut } from "../../components/product/Crossing";
import StatusPill from "../../components/product/StatusPill";
import ZcashTx from "../../components/product/ZcashTx";
import { describeError } from "../../lib/errors";
import { usdc } from "../../lib/solana";
import {
  fetchZecReturns, isShieldedTestAddress, RETURN_LABEL, setReturnAddress, usdPerZec, zec, zecReturnsKey,
} from "../../lib/zcash";
import { tr } from "../../i18n";

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
      toast.success(tr({ en: "Saved. What is owed to you is queued for the treasury to send.", pt: "Salvo. O que é devido a você está na fila para a tesouraria enviar." }));
      setEditing(false);
      setAddress("");
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (e) => toast.error(describeError(e)),
  });

  if (returns.isError) return <Panel title={tr({ en: "Returns in ZEC", pt: "Retornos em ZEC" })}><LoadError compact error={returns.error} onRetry={() => returns.refetch()} /></Panel>;
  const d = returns.data;
  const valid = isShieldedTestAddress(address);
  // Every zatoshi this position has in play, paid or queued. What it is worth
  // crossing to Solana is the one question a ZEC-paid investor asks that this
  // page could not answer before.
  const inPlay = d?.returns.reduce((sum, r) => sum + (r.amount_zat ?? 0), 0) ?? 0;

  return (
    <Panel title={tr({ en: "Returns in ZEC", pt: "Retornos em ZEC" })}
      description={tr({
        en: "You paid in shielded ZEC and have no Solana wallet here, so what comes back to you — each instalment's share, or a refund — is paid in shielded ZEC from EmpowerFI's treasury, at CoinGecko's quote when it is sent. The conversion from reais is simulated; the ZEC is real testnet ZEC.",
        pt: "Você pagou em ZEC blindado e não tem carteira Solana aqui, então o que volta para você — sua parte de cada parcela, ou um reembolso — é pago em ZEC blindado pela tesouraria da EmpowerFI, pela cotação da CoinGecko no momento do envio. A conversão de reais é simulada; o ZEC é ZEC real da testnet.",
      })}>
      {!d ? <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} /> : (
        <div className="space-y-4">
          {d.return_address && !editing ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{tr({ en: "Your return address", pt: "Seu endereço de retorno" })}</span>
                <span className="block truncate font-mono text-xs text-foreground" title={d.return_address}>
                  {d.return_address.slice(0, 14)}…{d.return_address.slice(-8)}
                </span>
              </span>
              {!readOnly && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{tr({ en: "Change", pt: "Alterar" })}</Button>}
            </div>
          ) : readOnly ? (
            <p className="text-sm text-muted-foreground">{tr({ en: "No return address yet.", pt: "Ainda sem endereço de retorno." })}</p>
          ) : (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
              <Label htmlFor={`ret-${investmentId}`}>{tr({ en: "Shielded address for your returns", pt: "Endereço blindado para seus retornos" })}</Label>
              <div className="flex flex-wrap gap-2">
                <Input id={`ret-${investmentId}`} className="min-w-0 flex-1 font-mono text-xs" placeholder={tr({ en: "utest1… or ztestsapling1…", pt: "utest1… ou ztestsapling1…" })}
                  value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" spellCheck={false} />
                <Button type="submit" disabled={!valid || save.isPending} className="gap-1.5">
                  {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {tr({ en: "Save", pt: "Salvar" })}
                </Button>
                {editing && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>{tr({ en: "Cancel", pt: "Cancelar" })}</Button>}
              </div>
              <p className={`text-xs ${address && !valid ? "text-caution" : "text-muted-foreground"}`}>
                {address && !valid
                  ? tr({
                    en: "A unified (utest1…) or Sapling (ztestsapling1…) testnet address: transparent addresses are not accepted.",
                    pt: "Um endereço unificado (utest1…) ou Sapling (ztestsapling1…) da testnet: endereços transparentes não são aceitos.",
                  })
                  : owed ? tr({ en: "Something is owed to you already: it is sent once you save.", pt: "Já há um valor devido a você: ele é enviado assim que você salvar." })
                  : tr({ en: "Only EmpowerFI's treasury key and its auditor can see payments to it.", pt: "Só a chave da tesouraria da EmpowerFI e o auditor dela veem os pagamentos para ele." })}
              </p>
            </form>
          )}

          {d.returns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{owed && !d.return_address ? tr({ en: "Held until you give an address.", pt: "Retido até você informar um endereço." }) : tr({ en: "Nothing paid back yet.", pt: "Nada foi pago de volta ainda." })}</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.returns.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="text-foreground">{r.kind === "refund" ? tr({ en: "Refund", pt: "Reembolso" }) : tr({ en: `Instalment ${r.instalment_no ?? "—"}`, pt: `Parcela ${r.instalment_no ?? "—"}` })}</span>
                    <span className="block text-xs text-muted-foreground">
                      {usdc(r.amount_micro_usdc)}{r.amount_zat
                        ? tr({ en: ` → ${zec(r.amount_zat)} at ${usdPerZec(r.usd_per_zec_cents!)} per ZEC`, pt: ` → ${zec(r.amount_zat)} a ${usdPerZec(r.usd_per_zec_cents!)} por ZEC` })
                        : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {r.txid && (
                      <ZcashTx txid={r.txid} />
                    )}
                    <StatusPill tone={RETURN_LABEL[r.status].tone}>{RETURN_LABEL[r.status].label}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {inPlay > 0 && (
            <div className="space-y-1.5">
              <CrossingOut zat={inPlay} />
              <p className="text-[11px] text-muted-foreground">
                {tr({
                  en: "What this ZEC is worth crossing to USDC on Solana today, if you would rather hold dollars than ZEC. EmpowerFI does not make that crossing for you.",
                  pt: "Quanto este ZEC vale atravessando para USDC na Solana hoje, se você preferir ficar com dólares em vez de ZEC. A EmpowerFI não faz essa travessia por você.",
                })}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "Sending ZEC needs the treasury's spending key, which never leaves EmpowerFI's operator: on testnet the operator sends what is owed in batches. On the explorer, a shielded payment shows only that a transaction happened.",
              pt: "Enviar ZEC exige a chave de gasto da tesouraria, que nunca sai do operador da EmpowerFI: na testnet, o operador envia o que é devido em lotes. No explorer, um pagamento blindado mostra só que uma transação aconteceu.",
            })}
          </p>
        </div>
      )}
    </Panel>
  );
}
