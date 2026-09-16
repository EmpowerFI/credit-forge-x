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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localized, tr } from "../../i18n";
import Panel from "../../components/product/Panel";
import { useAuth } from "../../auth/useAuth";
import { describeError } from "../../lib/errors";
import { type MarketRow, usdcFromReais } from "../../lib/investor";
import { explorerTx, platform } from "../../lib/platform";
import { CLUSTER, confirmSignature, FAUCETS, rpc, usdc, USDC_DECIMALS, USDC_MINT, usdcAccountOf, vaultAddress } from "../../lib/solana";
import { LIVE } from "../../lib/zcash";
import { useBalances } from "../../wallet/useBalances";
import ConnectWalletDialog from "../../wallet/ConnectWallet";
import ZecInvest from "./ZecInvest";

type Step = "sign" | "confirm" | "record" | "done";
const STEPS: { key: Step; label: string }[] = localized([
  { key: "sign", label: { en: "Approve the transfer in your wallet", pt: "Aprove a transferência na sua carteira" } },
  { key: "confirm", label: { en: "Confirming on Solana", pt: "Confirmando na Solana" } },
  { key: "record", label: { en: "Recording your allocation", pt: "Registrando sua alocação" } },
  { key: "done", label: { en: "Allocated", pt: "Alocado" } },
]);

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
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />} {tr({ en: "Invest with Devnet USDC", pt: "Investir com USDC da Devnet" })}
        </Button>
      )}
      {step && (
        <ol className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4" aria-label={tr({ en: "Transaction progress", pt: "Andamento da transação" })}>
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
        <Button variant="secondary" className="w-full" onClick={invest}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
      )}
      {step === "done" && investmentId && (
        <Button className="w-full" onClick={() => navigate(`/app/investor/positions/${investmentId}`)}>{tr({ en: "View your position", pt: "Ver sua posição" })}</Button>
      )}
    </div>
  );
}

/** The latest request of mine for this opportunity that is still on its way, so a reload picks it up. */
function useLiveZcashRequest(opportunityId: string, investorId: string | undefined) {
  return useQuery({
    queryKey: ["platform", "zcash-live", opportunityId, investorId],
    enabled: Boolean(investorId),
    queryFn: async () => {
      const { data, error } = await platform.from("zcash_payment_requests").select("id")
        .eq("opportunity_id", opportunityId).eq("investor_id", investorId!).in("status", LIVE)
        .order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data[0]?.id ?? null;
    },
  });
}

/** Invest in one opportunity from the connected wallet or with shielded ZEC, or explain what is needed first. */
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
    ? Math.round(usdcFromReais(row.instalment_cents * row.term_months, row.fx_brl_per_usdc_milli) * share)
    : null;

  const live = useLiveZcashRequest(row.opportunity_id, profile?.id);
  const [zecRequest, setZecRequest] = useState<string | null | undefined>(undefined);
  const requestId = zecRequest === undefined ? live.data ?? null : zecRequest;
  const [method, setMethod] = useState<"usdc" | "zec" | null>(null);
  const via = method ?? (requestId ? "zec" : "usdc");

  const problem =
    !open ? tr({ en: "This opportunity is no longer raising.", pt: "Esta oportunidade não está mais captando." })
    : micro <= 0 ? tr({ en: "Enter an amount.", pt: "Informe um valor." })
    : micro > remaining ? tr({ en: `Only ${usdc(remaining)} is left to fund.`, pt: `Faltam só ${usdc(remaining)} para captar.` })
    : via === "zec" && micro < 10 ** USDC_DECIMALS ? tr({ en: "The smallest allocation is 1 USDC.", pt: "A alocação mínima é de 1 USDC." })
    : via === "usdc" && connected && balances.data && micro > balance ? tr({ en: `Your wallet holds ${usdc(balance)}.`, pt: `Sua carteira tem ${usdc(balance)}.` })
    : via === "usdc" && connected && balances.data && balances.data.lamports === 0n
      ? tr({ en: "Your wallet needs a little test SOL for the network fee.", pt: "Sua carteira precisa de um pouco de SOL de teste para a taxa da rede." })
    : null;

  return (
    <Panel title={tr({ en: "Invest", pt: "Investir" })}>
      {!open && !requestId ? (
        <p className="text-sm text-muted-foreground">
          {row.funding_status === "funded"
            ? tr({ en: "Fully funded — EmpowerFI's P2P desk formalises and disburses next.", pt: "100% captada. Agora a mesa P2P da EmpowerFI formaliza e desembolsa." })
            : tr({ en: "Closed to new investment.", pt: "Fechada para novos investimentos." })}
        </p>
      ) : (
        <div className="space-y-4">
          <div role="radiogroup" aria-label={tr({ en: "Pay with", pt: "Pagar com" })} className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1">
            {([
              ["usdc", tr({ en: "Devnet USDC", pt: "USDC da Devnet" }), tr({ en: "from a Solana wallet", pt: "de uma carteira Solana" })],
              ["zec", tr({ en: "Shielded ZEC", pt: "ZEC blindado" }), tr({ en: "from a Zcash wallet", pt: "de uma carteira Zcash" })],
            ] as const).map(([key, label, hint]) => (
              <button key={key} type="button" role="radio" aria-checked={via === key} onClick={() => setMethod(key)}
                className={`rounded-lg px-2 py-1.5 text-left transition-colors ${via === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-[11px]">{hint}</span>
              </button>
            ))}
          </div>

          {via === "zec" && requestId ? (
            <ZecInvest row={row} micro={micro} problem={problem} requestId={requestId} onRequest={setZecRequest} />
          ) : (
          <>
          {via === "usdc" && connected && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{tr({ en: "Wallet balance", pt: "Saldo da carteira" })}</span>
              <span className="num font-semibold text-foreground">{balances.data ? usdc(balance) : "…"}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="invest-amount">{tr({ en: "Amount", pt: "Valor" })}</Label>
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
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">{tr({ en: "Max", pt: "Máx." })}</button>
            </div>
          </div>
          {problem && micro > 0 && <p className="text-xs text-caution">{problem}</p>}

          {via === "zec" ? (
            <ZecInvest row={row} micro={micro} problem={problem} requestId={null} onRequest={setZecRequest} />
          ) : !wallet ? (
            <div className="space-y-2">
              <Button className="h-11 w-full" onClick={async () => { await signOut(); navigate("/app/login"); }}>
                <Wallet size={18} /> {tr({ en: "Sign in with your wallet to invest", pt: "Entre com a sua carteira para investir" })}
              </Button>
              <p className="text-xs text-muted-foreground">
                {tr({
                  en: "You are exploring as the demo investor, whose seeded positions are simulated. Sign in with a Solana wallet, or pay with shielded ZEC.",
                  pt: "Você está explorando como o investidor de demonstração, com posições simuladas. Entre com uma carteira Solana ou pague com ZEC blindado.",
                })}
              </p>
            </div>
          ) : !connected ? (
            <>
              <Button className="h-11 w-full" onClick={() => setConnecting(true)}><Wallet size={18} /> {tr({ en: "Reconnect your wallet", pt: "Reconecte sua carteira" })}</Button>
              <ConnectWalletDialog open={connecting} onOpenChange={setConnecting} onConnected={() => setConnecting(false)} />
            </>
          ) : (
            <InvestAction account={account!} row={row} micro={micro} disabled={Boolean(problem)} />
          )}

          {via === "usdc" && connected && balances.data && (balance === 0 || balances.data.lamports === 0n) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {balances.data.lamports === 0n && (
                <a href={FAUCETS.sol} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 hover:bg-secondary">
                  {tr({ en: "Get test SOL", pt: "Obter SOL de teste" })} <ExternalLink size={11} />
                </a>
              )}
              {balance === 0 && (
                <a href={FAUCETS.usdc} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 hover:bg-secondary">
                  {tr({ en: "Get test USDC", pt: "Obter USDC de teste" })} <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          </>
          )}

          <p className="text-xs text-muted-foreground">
            {via === "zec"
              ? tr({
                en: "Real on Zcash testnet and Solana devnet: the payment, the vault's USDC and the proof. Simulated: the ZEC→USDC conversion, which NEAR Intents does in production and has no testnet.",
                pt: "Real na testnet da Zcash e na devnet da Solana: o pagamento, o USDC do cofre e a prova. Simulado: a conversão de ZEC para USDC, que a NEAR Intents faz em produção e não tem testnet.",
              })
              : tr({ en: "Simulation only · Devnet tokens have no real value.", pt: "Apenas simulação · Os tokens da Devnet não têm valor real." })}
          </p>
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <p className="font-medium text-foreground">{tr({ en: "Expected cash flows", pt: "Fluxo de caixa esperado" })}</p>
            <p className="text-muted-foreground">
              {expectedBack !== null && micro > 0 && !(via === "zec" && requestId)
                ? tr({
                  en: <>Your share of scheduled repayments: <span className="num text-foreground">≈ {usdc(expectedBack)}</span> over {row.term_months} months, at the reference rate and today's demo quote. Indicative, not a promise.</>,
                  pt: <>Sua parte dos pagamentos previstos: <span className="num text-foreground">≈ {usdc(expectedBack)}</span> em {row.term_months} meses, à taxa de referência e à cotação de demonstração de hoje. Indicativo, não é promessa.</>,
                })
                : tr({ en: "Principal plus your share of each instalment, as the loan is repaid.", pt: "O principal mais a sua parte de cada parcela, conforme o empréstimo é pago." })}
            </p>
            <Link to="/app/investor/portfolio" className="text-xs text-info hover:underline">{tr({ en: "Your positions →", pt: "Suas posições →" })}</Link>
          </div>
        </div>
      )}
    </Panel>
  );
}
