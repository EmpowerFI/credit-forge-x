import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleDashed, Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QrCode from "../../components/QrCode";
import ExplorerLink from "../../components/product/ExplorerLink";
import StatusPill from "../../components/product/StatusPill";
import { describeError } from "../../lib/errors";
import type { MarketRow } from "../../lib/investor";
import { usdc } from "../../lib/solana";
import {
  checkZcashNow, createZcashRequest, fetchZcashRequest, isShieldedTestAddress, LIVE, paymentUri, POOL_LABEL, setReturnAddress,
  STATUS_LABEL, usdPerZec, zcashExplorerTx, ZCASH_FAUCET, zec, type ZcashRequest,
} from "../../lib/zcash";
import { formatNumber, tr } from "../../i18n";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-label={tr({ en: `Copy ${label}`, pt: `Copiar ${label}` })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard refused: the value is on screen to select
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
      {copied ? <Check size={12} className="text-positive" /> : <Copy size={12} />} {copied ? tr({ en: "Copied", pt: "Copiado" }) : tr({ en: "Copy", pt: "Copiar" })}
    </button>
  );
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return <span className="num">{left > 0 ? `${m}:${String(s).padStart(2, "0")}` : tr({ en: "expired", pt: "expirado" })}</span>;
}

type StepState = "done" | "active" | "waiting" | "failed";

function Step({ state, title, children }: { state: StepState; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5">
        {state === "done" ? <Check size={16} className="text-positive" />
          : state === "active" ? <Loader2 size={16} className="animate-spin text-accent" />
          : state === "failed" ? <X size={16} className="text-alert" />
          : <CircleDashed size={16} className="text-muted-foreground" />}
      </span>
      <span className={state === "waiting" ? "text-muted-foreground" : "text-foreground"}>
        {title}
        {children && <span className="mt-0.5 block text-xs text-muted-foreground">{children}</span>}
      </span>
    </li>
  );
}

/** Where the request stands, step by step: paid on Zcash, confirmed, credited to the vault, proven on Solana. */
function Progress({ r }: { r: ZcashRequest }) {
  const order = ["awaiting", "seen", "confirmed", "credited"];
  const at = order.indexOf(r.status);
  const stopped = !LIVE.includes(r.status) && r.status !== "credited";
  const state = (i: number): StepState =>
    stopped ? (i < at || (r.txid && i === 0) ? "done" : i === Math.max(at, 1) ? "failed" : "waiting")
    : r.status === "credited" ? "done" : i < at ? "done" : i === at ? "active" : "waiting";

  return (
    <ol className="space-y-2.5 rounded-xl border border-border bg-secondary/40 p-4" aria-label={tr({ en: "Payment progress", pt: "Andamento do pagamento" })}>
      <Step state={r.txid ? "done" : stopped ? "failed" : "active"} title={tr({ en: "Pay from your Zcash wallet", pt: "Pague pela sua carteira Zcash" })}>
        {r.txid
          ? tr({
            en: <>Paid {zec(r.received_zat, r.network)}{r.pool && ` · ${POOL_LABEL[r.pool]} pool`}</>,
            pt: <>Pago {zec(r.received_zat, r.network)}{r.pool && ` · pool ${POOL_LABEL[r.pool]}`}</>,
          })
          : tr({ en: "Waiting for the payment to reach a block.", pt: "Aguardando o pagamento entrar em um bloco." })}
      </Step>
      <Step state={state(1)} title={tr({ en: "Seen in a Zcash block", pt: "Visto em um bloco da Zcash" })}>
        {r.mined_height && (
          <>
            {tr({ en: "Block", pt: "Bloco" })} <span className="num">{formatNumber(r.mined_height)}</span> ·{" "}
            <span className="num">{Math.min(r.confirmations ?? 0, r.confirmations_needed)} {tr({ en: "of", pt: "de" })} {r.confirmations_needed}</span> {tr({ en: "confirmations", pt: "confirmações" })} ·{" "}
            <a href={zcashExplorerTx(r.txid!, r.network)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-info hover:underline">
              {tr({ en: "on the explorer", pt: "no explorer" })} <ExternalLink size={10} />
            </a>
          </>
        )}
      </Step>
      <Step state={state(2)} title={tr({ en: "Converted to USDC and credited to the vault", pt: "Convertido em USDC e creditado no cofre" })}>
        {tr({
          en: "Simulated conversion at the quote: the operator's devnet USDC transfer.",
          pt: "Conversão simulada pela cotação: a transferência de USDC da devnet feita pelo operador.",
        })}{" "}
        {r.credit_signature && <ExplorerLink tx={r.credit_signature} />}
      </Step>
      <Step state={r.status === "credited" ? (r.proof?.status === "confirmed" ? "done" : "active") : "waiting"}
        title={tr({ en: "Allocated and proven on Solana", pt: "Alocado e provado na Solana" })}>
        {r.proof?.signature && <ExplorerLink tx={r.proof.signature} />}
      </Step>
    </ol>
  );
}

/**
 * Invest by paying EmpowerFI's shielded treasury on Zcash testnet. Needs no
 * Solana wallet: the payment is the deposit, read with the treasury's viewing key.
 */
export default function ZecInvest({ row, micro, problem, requestId, onRequest }: {
  row: MarketRow;
  micro: number;
  problem: string | null;
  requestId: string | null;
  onRequest: (id: string | null) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState("");
  const returnOk = returnTo.trim() === "" || isShieldedTestAddress(returnTo);

  const request = useQuery({
    queryKey: ["platform", "zcash-request", requestId],
    queryFn: () => fetchZcashRequest(requestId!),
    enabled: Boolean(requestId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return !s || LIVE.includes(s) || (s === "credited" && q.state.data?.proof?.status !== "confirmed") ? 5000 : false;
    },
  });
  const r = request.data;

  useEffect(() => {
    if (r?.status === "credited") void queryClient.invalidateQueries({ queryKey: ["platform"] });
  }, [r?.status, queryClient]);

  const create = async () => {
    setError(null);
    setCreating(true);
    try {
      const created = await createZcashRequest(row.opportunity_id, micro);
      if (returnTo.trim()) {
        // The request stands either way; an address can be given later from the position.
        await setReturnAddress({ requestId: created.id }, returnTo).catch((e) =>
          setError(tr({
            en: `Request made, but the return address was not saved: ${describeError(e)}`,
            pt: `Pedido feito, mas o endereço de retorno não foi salvo: ${describeError(e)}`,
          })));
      }
      onRequest(created.id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setCreating(false);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      await checkZcashNow();
    } catch {
      // the minute's scan still comes
    } finally {
      setChecking(false);
      await request.refetch();
    }
  };

  if (!requestId) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="zec-return" className="text-xs text-muted-foreground">
            {tr({ en: "Shielded address for your returns (optional)", pt: "Endereço blindado para seus retornos (opcional)" })}
          </Label>
          <Input id="zec-return" className="font-mono text-xs" placeholder={tr({ en: "utest1… or ztestsapling1…", pt: "utest1… ou ztestsapling1…" })} value={returnTo}
            onChange={(e) => setReturnTo(e.target.value)} autoComplete="off" spellCheck={false} />
          <p className={`text-xs ${returnOk ? "text-muted-foreground" : "text-caution"}`}>
            {returnOk
              ? tr({
                en: "Instalment shares and any refund come back here in shielded ZEC. You can add it later, from your position.",
                pt: "Sua parte das parcelas e qualquer reembolso voltam para cá em ZEC blindado. Você pode informar depois, pela sua posição.",
              })
              : tr({
                en: "A unified (utest1…) or Sapling (ztestsapling1…) testnet address: returns stay shielded.",
                pt: "Um endereço unificado (utest1…) ou Sapling (ztestsapling1…) da testnet: os retornos continuam blindados.",
              })}
          </p>
        </div>
        <Button className="h-11 w-full text-base font-semibold" disabled={Boolean(problem) || creating || !returnOk} onClick={create}>
          {creating ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} {tr({ en: "Get a shielded payment request", pt: "Gerar um pedido de pagamento blindado" })}
        </Button>
        {error && <p className="text-xs text-alert">{error}</p>}
        <p className="text-xs text-muted-foreground">
          {tr({
            en: "Pay from any Zcash wallet. The amount, the memo and who paid stay shielded on Zcash: only EmpowerFI's treasury key, and the auditor it is disclosed to, can read them. No Solana wallet needed.",
            pt: "Pague de qualquer carteira Zcash. O valor, o memo e quem pagou ficam blindados na Zcash: só a chave da tesouraria da EmpowerFI, e o auditor a quem ela é revelada, podem lê-los. Não precisa de carteira Solana.",
          })}
        </p>
      </div>
    );
  }
  if (request.isError) {
    return <p className="text-sm text-alert">{describeError(request.error)}</p>;
  }
  if (!r) return <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;

  const uri = paymentUri(r);
  const status = STATUS_LABEL[r.status];
  const over = !LIVE.includes(r.status) && r.status !== "credited";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{r.ref}</span>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      {r.status === "awaiting" && (
        <div className="space-y-3">
          <a href={uri} className="mx-auto block w-full max-w-[220px]" aria-label={tr({ en: "Open the payment in your Zcash wallet", pt: "Abrir o pagamento na sua carteira Zcash" })}>
            <QrCode value={uri} label={tr({ en: `Zcash payment request ${r.ref}`, pt: `Pedido de pagamento Zcash ${r.ref}` })} className="w-full" />
          </a>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" size="sm"><a href={uri}>{tr({ en: "Open in wallet", pt: "Abrir na carteira" })}</a></Button>
            <CopyLink uri={uri} />
          </div>
          <dl className="space-y-1.5 rounded-xl border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{tr({ en: "Pay exactly", pt: "Pague exatamente" })}</dt>
              <dd className="flex items-center gap-2"><span className="num font-semibold text-foreground">{zec(r.amount_zat, r.network)}</span><CopyButton value={String(r.amount_zat / 1e8)} label={tr({ en: "amount", pt: "valor" })} /></dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{tr({ en: "To", pt: "Para" })}</dt>
              <dd className="flex min-w-0 items-center gap-2"><span className="truncate font-mono text-xs text-foreground">{r.address.slice(0, 10)}…{r.address.slice(-6)}</span><CopyButton value={r.address} label={tr({ en: "address", pt: "endereço" })} /></dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{tr({ en: "Memo", pt: "Memo" })}</dt>
              <dd className="flex min-w-0 items-center gap-2"><span className="truncate font-mono text-xs text-foreground">{r.memo}</span><CopyButton value={r.memo} label={tr({ en: "memo", pt: "memo" })} /></dd>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              {tr({
                en: "Your wallet fills these in from the code or the link. The memo is how the payment finds your allocation.",
                pt: "Sua carteira preenche esses dados pelo código ou pelo link. É pelo memo que o pagamento encontra a sua alocação.",
              })}
            </p>
          </dl>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: <>Holds <span className="num text-foreground">{usdc(r.amount_micro_usdc)}</span> of this opportunity for <Countdown until={r.expires_at} />.</>,
              pt: <>Reserva <span className="num text-foreground">{usdc(r.amount_micro_usdc)}</span> desta oportunidade por <Countdown until={r.expires_at} />.</>,
            })}
          </p>
        </div>
      )}

      <Progress r={r} />

      <p className="text-xs text-muted-foreground">
        {tr({
          en: `${usdc(r.amount_micro_usdc)} at ${usdPerZec(r.usd_per_zec_cents)} per ZEC${r.quote_source === "coingecko" ? ", CoinGecko's quote when you asked" : ", a demo quote"}. Testnet ZEC has no value.`,
          pt: `${usdc(r.amount_micro_usdc)} a ${usdPerZec(r.usd_per_zec_cents)} por ZEC${r.quote_source === "coingecko" ? ", cotação da CoinGecko no momento do pedido" : ", uma cotação de demonstração"}. ZEC da testnet não tem valor.`,
        })}
      </p>

      {r.status === "credited" && r.investment_id && (
        <Button className="w-full" onClick={() => navigate(`/app/investor/positions/${r.investment_id}`)}>{tr({ en: "View your position", pt: "Ver sua posição" })}</Button>
      )}
      {(r.status === "awaiting" || r.status === "seen" || r.status === "confirmed") && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {tr({
              en: `Read up to block ${r.scanned_height != null ? formatNumber(r.scanned_height) : "—"}; checked every minute.`,
              pt: `Lido até o bloco ${r.scanned_height != null ? formatNumber(r.scanned_height) : "—"}; verificado a cada minuto.`,
            })}
          </span>
          <Button variant="ghost" size="sm" onClick={checkNow} disabled={checking}>
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} /> {tr({ en: "Check now", pt: "Verificar agora" })}
          </Button>
        </div>
      )}
      {over && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {r.status === "expired" ? tr({ en: "No payment arrived in time, so nothing was held.", pt: "Nenhum pagamento chegou a tempo, então nada ficou reservado." })
              : r.status === "underpaid" ? tr({
                en: `It paid ${zec(r.received_zat, r.network)} of ${zec(r.amount_zat, r.network)}. EmpowerFI settles this by hand: nothing was allocated.`,
                pt: `Foram pagos ${zec(r.received_zat, r.network)} de ${zec(r.amount_zat, r.network)}. A EmpowerFI resolve isso manualmente: nada foi alocado.`,
              })
              : r.error ?? tr({ en: "The payment could not be allocated.", pt: "Não foi possível alocar o pagamento." })}
          </p>
          <Button variant="secondary" className="w-full" onClick={() => onRequest(null)}>{tr({ en: "Start a new request", pt: "Fazer um novo pedido" })}</Button>
        </div>
      )}
      {r.status === "awaiting" && (
        <a href={ZCASH_FAUCET} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-secondary">
          {tr({ en: "Get testnet ZEC", pt: "Obter ZEC de testnet" })} <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function CopyLink({ uri }: { uri: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="secondary" size="sm" onClick={async () => {
      try {
        await navigator.clipboard.writeText(uri);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // clipboard refused
      }
    }}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? tr({ en: "Copied", pt: "Copiado" }) : tr({ en: "Copy link", pt: "Copiar link" })}
    </Button>
  );
}
