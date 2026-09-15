import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CircleDashed, ExternalLink, Loader2, Wallet, X } from "lucide-react";
import {
  address,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  getBase58Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
} from "@solana/kit";
import { getTransferCheckedInstruction } from "@solana-program/token";
import { useSelectedWalletAccount, useWalletAccountTransactionSendingSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Panel from "../../components/product/Panel";
import { useAuth } from "../../auth/useAuth";
import { describeError } from "../../lib/errors";
import type { MarketRow } from "../../lib/investor";
import { explorerTx, platform } from "../../lib/platform";
import { CLUSTER, confirmSignature, FAUCETS, rpc, usdc, USDC_DECIMALS, USDC_MINT, usdcAccountOf, vaultAddress } from "../../lib/solana";
import { useBalances } from "../../wallet/useBalances";
import ConnectWalletDialog from "../../wallet/ConnectWallet";

type Step = "sign" | "confirm" | "record" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "sign", label: "Approve the transfer in your wallet" },
  { key: "confirm", label: "Confirming on Solana" },
  { key: "record", label: "Recording your allocation" },
  { key: "done", label: "Allocated" },
];

async function recordAllocation(opportunityId: string, signature: string) {
  const { data, error } = await platform.functions.invoke("investment-confirm", {
    body: { opportunity_id: opportunityId, signature },
  });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  return data as { id: string; amount_micro_usdc: number };
}

/** The transfer itself: needs the connected account, so it lives in its own component. */
function InvestAction({ account, row, micro, disabled }: {
  account: UiWalletAccount;
  row: MarketRow;
  micro: number;
  disabled: boolean;
}) {
  const signer = useWalletAccountTransactionSendingSigner(account, CLUSTER);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step | null>(null);
  const [failedAt, setFailedAt] = useState<{ step: Step; message: string } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [investmentId, setInvestmentId] = useState<string | null>(null);

  const invest = async () => {
    setFailedAt(null);
    setSignature(null);
    let current: Step = "sign";
    try {
      setStep("sign");
      const [source, destination] = await Promise.all([usdcAccountOf(address(account.address)), vaultAddress()]);
      const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
        (m) => appendTransactionMessageInstruction(
          getTransferCheckedInstruction({
            source, mint: USDC_MINT, destination, authority: signer, amount: BigInt(micro), decimals: USDC_DECIMALS,
          }), m),
      );
      const sent = getBase58Decoder().decode(await signAndSendTransactionMessageWithSigners(message));
      setSignature(sent);
      current = "confirm";
      setStep("confirm");
      await confirmSignature(sent);
      current = "record";
      setStep("record");
      const recorded = await recordAllocation(row.opportunity_id, sent);
      setInvestmentId(recorded.id);
      setStep("done");
      await queryClient.invalidateQueries({ queryKey: ["platform"] });
      await queryClient.invalidateQueries({ queryKey: ["solana", "balances"] });
    } catch (err) {
      setFailedAt({ step: current, message: describeError(err) });
    }
  };

  const busy = step !== null && step !== "done" && !failedAt;
  const position = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4">
      {step !== "done" && (
        <Button className="h-11 w-full text-base font-semibold" disabled={disabled || busy} onClick={invest}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />} Invest with Devnet USDC
        </Button>
      )}
      {step && (
        <ol className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4" aria-label="Transaction progress">
          {STEPS.map((s, i) => {
            const failed = failedAt?.step === s.key;
            const doneStep = i < position || step === "done";
            const active = i === position && !failed && step !== "done";
            return (
              <li key={s.key} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5">
                  {failed ? <X size={16} className="text-alert" /> : doneStep ? <Check size={16} className="text-positive" />
                    : active ? <Loader2 size={16} className="animate-spin text-accent" /> : <CircleDashed size={16} className="text-muted-foreground" />}
                </span>
                <span className={failed ? "text-alert" : doneStep || active ? "text-foreground" : "text-muted-foreground"}>
                  {s.label}
                  {failed && <span className="block text-xs">{failedAt!.message}</span>}
                  {s.key === "confirm" && signature && (
                    <a href={explorerTx(signature)} target="_blank" rel="noopener noreferrer"
                      className="mt-0.5 flex items-center gap-1 font-mono text-xs text-info hover:underline">
                      {signature.slice(0, 8)}…{signature.slice(-8)} <ExternalLink size={11} />
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {failedAt && (
        <Button variant="secondary" className="w-full" onClick={invest}>Try again</Button>
      )}
      {step === "done" && investmentId && (
        <Button className="w-full" onClick={() => navigate(`/app/investor/positions/${investmentId}`)}>View your position</Button>
      )}
    </div>
  );
}

/** Invest in one opportunity from the connected wallet, or explain what is needed first. */
export default function InvestPanel({ row }: { row: MarketRow }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [account] = useSelectedWalletAccount();
  const [connecting, setConnecting] = useState(false);
  const wallet = profile?.wallet_address ?? null;
  const connected = Boolean(account && wallet && account.address === wallet);
  const balances = useBalances(connected ? wallet : null);
  const remaining = Math.max(0, (row.funding_target_micro_usdc ?? 0) - row.funded_micro_usdc);
  const [amount, setAmount] = useState("10");
  const micro = Math.round(Number(amount || 0) * 10 ** USDC_DECIMALS);
  const balance = Number(balances.data?.microUsdc ?? 0);
  const open = row.funding_status === "open" || row.funding_status === "partially_funded";
  const share = row.funding_target_micro_usdc ? micro / row.funding_target_micro_usdc : 0;
  const expectedBack = row.instalment_cents && row.fx_brl_per_usdc_milli
    ? Math.round((row.instalment_cents * row.term_months * share * 10000) / row.fx_brl_per_usdc_milli)
    : null;

  const problem =
    !open ? "This opportunity is no longer raising."
    : micro <= 0 ? "Enter an amount."
    : micro > remaining ? `Only ${usdc(remaining)} is left to fund.`
    : connected && balances.data && micro > balance ? `Your wallet holds ${usdc(balance)}.`
    : connected && balances.data && balances.data.lamports === 0n ? "Your wallet needs a little test SOL for the network fee."
    : null;

  return (
    <Panel title="Invest">
      {!open ? (
        <p className="text-sm text-muted-foreground">
          {row.funding_status === "funded" ? "Fully funded — the partner formalises and disburses next." : "Closed to new investment."}
        </p>
      ) : (
        <div className="space-y-4">
          {connected && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet balance</span>
              <span className="num font-semibold text-foreground">{balances.data ? usdc(balance) : "…"}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="invest-amount">Amount</Label>
            <div className="relative">
              <Input id="invest-amount" type="number" inputMode="decimal" min={1} step="1" value={amount}
                onChange={(e) => setAmount(e.target.value)} className="h-12 pr-16 text-lg font-semibold" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">USDC</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[5, 10, 25].map((v) => (
                <button key={v} type="button" onClick={() => setAmount(String(v))}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">{v}</button>
              ))}
              <button type="button" onClick={() => setAmount(String(Math.floor(Math.min(remaining, connected ? balance || remaining : remaining) / 1e6)))}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">Max</button>
            </div>
          </div>
          {problem && micro > 0 && <p className="text-xs text-caution">{problem}</p>}

          {!wallet ? (
            <div className="space-y-2">
              <Button className="h-11 w-full" onClick={async () => { await signOut(); navigate("/app/login"); }}>
                <Wallet size={18} /> Sign in with your wallet to invest
              </Button>
              <p className="text-xs text-muted-foreground">You are exploring as the demo investor, who invests with simulated positions only.</p>
            </div>
          ) : !connected ? (
            <>
              <Button className="h-11 w-full" onClick={() => setConnecting(true)}><Wallet size={18} /> Reconnect your wallet</Button>
              <ConnectWalletDialog open={connecting} onOpenChange={setConnecting} onConnected={() => setConnecting(false)} />
            </>
          ) : (
            <InvestAction account={account!} row={row} micro={micro} disabled={Boolean(problem)} />
          )}

          {connected && balances.data && (balance === 0 || balances.data.lamports === 0n) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {balances.data.lamports === 0n && (
                <a href={FAUCETS.sol} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 hover:bg-secondary">
                  Get test SOL <ExternalLink size={11} />
                </a>
              )}
              {balance === 0 && (
                <a href={FAUCETS.usdc} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 hover:bg-secondary">
                  Get test USDC <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">Simulation only · Devnet tokens have no real value.</p>
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <p className="font-medium text-foreground">Expected cash flows</p>
            <p className="text-muted-foreground">
              {expectedBack !== null && micro > 0
                ? <>Your share of scheduled repayments: <span className="num text-foreground">≈ {usdc(expectedBack)}</span> over {row.term_months} months, at the reference rate and today's demo quote. Indicative, not a promise.</>
                : "Principal plus your share of each instalment, as the loan is repaid."}
            </p>
            <Link to="/app/investor/portfolio" className="text-xs text-info hover:underline">Your positions →</Link>
          </div>
        </div>
      )}
    </Panel>
  );
}
