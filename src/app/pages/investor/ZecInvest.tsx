import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleDashed, Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import QrCode from "../../components/QrCode";
import ExplorerLink from "../../components/product/ExplorerLink";
import StatusPill from "../../components/product/StatusPill";
import { describeError } from "../../lib/errors";
import type { MarketRow } from "../../lib/investor";
import { usdc } from "../../lib/solana";
import {
  checkZcashNow, createZcashRequest, fetchZcashRequest, LIVE, paymentUri, POOL_LABEL, STATUS_LABEL, usdPerZec, zcashExplorerTx,
  ZCASH_FAUCET, zec, type ZcashRequest,
} from "../../lib/zcash";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`}
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
      {copied ? <Check size={12} className="text-positive" /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
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
  return <span className="num">{left > 0 ? `${m}:${String(s).padStart(2, "0")}` : "expired"}</span>;
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
    <ol className="space-y-2.5 rounded-xl border border-border bg-secondary/40 p-4" aria-label="Payment progress">
      <Step state={r.txid ? "done" : stopped ? "failed" : "active"} title="Pay from your Zcash wallet">
        {r.txid ? <>Paid {zec(r.received_zat, r.network)}{r.pool && ` · ${POOL_LABEL[r.pool]} pool`}</> : "Waiting for the payment to reach a block."}
      </Step>
      <Step state={state(1)} title="Seen in a Zcash block">
        {r.mined_height && (
          <>
            Block <span className="num">{r.mined_height.toLocaleString("en-US")}</span> ·{" "}
            <span className="num">{Math.min(r.confirmations ?? 0, r.confirmations_needed)} of {r.confirmations_needed}</span> confirmations ·{" "}
            <a href={zcashExplorerTx(r.txid!, r.network)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-info hover:underline">
              on the explorer <ExternalLink size={10} />
            </a>
          </>
        )}
      </Step>
      <Step state={state(2)} title="Converted to USDC and credited to the vault">
        Simulated conversion at the quote: the operator's devnet USDC transfer.{" "}
        {r.credit_signature && <ExplorerLink tx={r.credit_signature} />}
      </Step>
      <Step state={r.status === "credited" ? (r.proof?.status === "confirmed" ? "done" : "active") : "waiting"} title="Allocated and proven on Solana">
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
        <Button className="h-11 w-full text-base font-semibold" disabled={Boolean(problem) || creating} onClick={create}>
          {creating ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Get a shielded payment request
        </Button>
        {error && <p className="text-xs text-alert">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Pay from any Zcash wallet. The amount, the memo and who paid stay shielded on Zcash: only EmpowerFI's treasury key,
          and the auditor it is disclosed to, can read them. No Solana wallet needed.
        </p>
      </div>
    );
  }
  if (request.isError) {
    return <p className="text-sm text-alert">{describeError(request.error)}</p>;
  }
  if (!r) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;

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
          <a href={uri} className="mx-auto block w-full max-w-[220px]" aria-label="Open the payment in your Zcash wallet">
            <QrCode value={uri} label={`Zcash payment request ${r.ref}`} className="w-full" />
          </a>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" size="sm"><a href={uri}>Open in wallet</a></Button>
            <CopyLink uri={uri} />
          </div>
          <dl className="space-y-1.5 rounded-xl border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Pay exactly</dt>
              <dd className="flex items-center gap-2"><span className="num font-semibold text-foreground">{zec(r.amount_zat, r.network)}</span><CopyButton value={String(r.amount_zat / 1e8)} label="amount" /></dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">To</dt>
              <dd className="flex min-w-0 items-center gap-2"><span className="truncate font-mono text-xs text-foreground">{r.address.slice(0, 10)}…{r.address.slice(-6)}</span><CopyButton value={r.address} label="address" /></dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Memo</dt>
              <dd className="flex min-w-0 items-center gap-2"><span className="truncate font-mono text-xs text-foreground">{r.memo}</span><CopyButton value={r.memo} label="memo" /></dd>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">Your wallet fills these in from the code or the link. The memo is how the payment finds your allocation.</p>
          </dl>
          <p className="text-xs text-muted-foreground">
            Holds <span className="num text-foreground">{usdc(r.amount_micro_usdc)}</span> of this opportunity for <Countdown until={r.expires_at} />.
          </p>
        </div>
      )}

      <Progress r={r} />

      <p className="text-xs text-muted-foreground">
        {usdc(r.amount_micro_usdc)} at {usdPerZec(r.usd_per_zec_cents)} per ZEC
        {r.quote_source === "coingecko" ? ", CoinGecko's quote when you asked" : ", a demo quote"}. Testnet ZEC has no value.
      </p>

      {r.status === "credited" && r.investment_id && (
        <Button className="w-full" onClick={() => navigate(`/app/investor/positions/${r.investment_id}`)}>View your position</Button>
      )}
      {(r.status === "awaiting" || r.status === "seen" || r.status === "confirmed") && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            Read up to block {r.scanned_height?.toLocaleString("en-US") ?? "—"}; checked every minute.
          </span>
          <Button variant="ghost" size="sm" onClick={checkNow} disabled={checking}>
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} /> Check now
          </Button>
        </div>
      )}
      {over && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {r.status === "expired" ? "No payment arrived in time, so nothing was held."
              : r.status === "underpaid" ? `It paid ${zec(r.received_zat, r.network)} of ${zec(r.amount_zat, r.network)}. EmpowerFI settles this by hand: nothing was allocated.`
              : r.error ?? "The payment could not be allocated."}
          </p>
          <Button variant="secondary" className="w-full" onClick={() => onRequest(null)}>Start a new request</Button>
        </div>
      )}
      {r.status === "awaiting" && (
        <a href={ZCASH_FAUCET} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-secondary">
          Get testnet ZEC <ExternalLink size={11} />
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
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
