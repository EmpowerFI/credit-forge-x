import { useState } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { usdc } from "../../lib/solana";
import { POOL_LABEL, STATUS_LABEL, zcashExplorerTx, zec } from "../../lib/zcash";
import { useZcashAudit } from "./queries";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};

function Copyable({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="secondary" size="sm" aria-label={`Copy ${label}`} onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // clipboard refused: the value is on screen to select
      }
    }}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * EmpowerFI's shielded treasury as its viewing key reads it. The key is
 * disclosed to auditors: with it, anyone they trust can check these payments
 * in their own Zcash wallet, and still spend nothing.
 */
export default function Zcash() {
  const q = useZcashAudit();
  const [reveal, setReveal] = useState(false);
  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const d = q.data;
  if (!d.configured) {
    return <Panel title="No treasury yet"><p className="text-sm text-muted-foreground">EmpowerFI's Zcash treasury is not set up in this environment.</p></Panel>;
  }
  const behind = d.tip_height !== null && d.scanned_height !== null ? d.tip_height - d.scanned_height : null;
  const matched = d.receipts.filter((r) => r.ref).length;
  const credited = d.requests?.credited ?? 0;
  const net = d.network === "test" ? "Zcash testnet" : "Zcash mainnet";
  const devtool = `zcash-devtool wallet -w ./audit-view init-fvk --name audit --fvk "$UFVK" --birthday ${d.birthday_height} -s zecrocks
zcash-devtool wallet -w ./audit-view sync -s zecrocks
zcash-devtool wallet -w ./audit-view list-tx`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Received" value={zec(d.received_zat, d.network)} hint={`${d.receipts.length} note${d.receipts.length === 1 ? "" : "s"} read`} />
        <StatTile label="Matched to a request" value={matched} hint={`${d.receipts.length - matched} with no EmpowerFI memo`} />
        <StatTile label="Allocated" value={credited} hint="credited to the vault, proven on Solana" hintTone={credited ? "positive" : "info"} />
        <StatTile label="Watcher" value={behind === null ? "—" : behind <= 1 ? "Up to date" : `${behind} blocks behind`}
          hint={`block ${d.scanned_height?.toLocaleString("en-US") ?? "—"} · ${ago(d.scanned_at)}`} hintTone={behind !== null && behind <= 2 ? "positive" : "caution"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="The viewing key" description={`Disclosed to auditors, and to no one else. It reads every payment the treasury receives on ${net}, amounts and memos included, and can spend none of it.`}>
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <code className={`min-w-0 flex-1 break-all font-mono text-xs ${reveal ? "text-foreground" : "select-none text-muted-foreground"}`}>
                {reveal ? d.ufvk : `${d.ufvk.slice(0, 14)}${"•".repeat(40)}`}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setReveal((v) => !v)}>
                {reveal ? <EyeOff size={14} /> : <Eye size={14} />} {reveal ? "Hide" : "Reveal"}
              </Button>
              <Copyable value={d.ufvk} label="viewing key" />
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Treasury address</dt>
                <dd className="flex min-w-0 items-center gap-2"><span className="truncate font-mono text-xs text-foreground">{d.address.slice(0, 12)}…{d.address.slice(-6)}</span><Copyable value={d.address} label="address" /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Read from block</dt>
                <dd className="num text-foreground">{d.birthday_height.toLocaleString("en-US")}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Credited after</dt>
                <dd className="text-foreground">{d.confirmations_needed} confirmations</dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel title="Check it without us" description="Import the key into any Zcash wallet that takes a viewing key and it lists the same payments. With zcash-devtool:">
          <div className="relative overflow-x-auto rounded-xl border border-border bg-secondary/40">
            <pre className="p-3 font-mono text-xs leading-relaxed text-foreground">{devtool}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            Each memo names a random reference (EFI-…), never the investor or the opportunity: the reference ties the payment to its
            allocation here, and the allocation's proof is on Solana. A block explorer shows only that a shielded transaction happened.
          </p>
        </Panel>
      </div>

      <Panel title="Notes received" description="Every shielded note the viewing key decrypts, newest first, with what it paid for.">
        <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Block</th>
                <th className="py-2 pr-4 font-medium">Transaction</th>
                <th className="py-2 pr-4 font-medium">Pool</th>
                <th className="py-2 pr-4 text-right font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Memo</th>
                <th className="py-2 pr-4 font-medium">Request</th>
                <th className="py-2 pr-4 font-medium">USDC credit</th>
                <th className="py-2 font-medium">Allocation proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.receipts.map((r) => (
                <tr key={`${r.txid}:${r.pool}:${r.index}`}>
                  <td className="num py-2.5 pr-4 text-muted-foreground">{r.height.toLocaleString("en-US")}</td>
                  <td className="py-2.5 pr-4">
                    <a href={zcashExplorerTx(r.txid, d.network)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
                      {r.txid.slice(0, 4)}…{r.txid.slice(-4)} <ExternalLink size={11} aria-hidden />
                    </a>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{POOL_LABEL[r.pool]}</td>
                  <td className="num py-2.5 pr-4 text-right text-foreground">{zec(r.value_zat, d.network)}</td>
                  <td className="max-w-[16rem] truncate py-2.5 pr-4 font-mono text-xs text-muted-foreground" title={r.memo ?? undefined}>{r.memo ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    {r.ref ? (
                      <span className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs text-foreground">{r.ref} · {r.opportunity_code}</span>
                        {r.status && <span><StatusPill tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</StatusPill> <span className="num text-xs text-muted-foreground">{usdc(r.amount_micro_usdc)}</span></span>}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">none</span>}
                  </td>
                  <td className="py-2.5 pr-4">{r.credit_signature ? <ExplorerLink tx={r.credit_signature} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="py-2.5">{r.allocation_signature ? <ExplorerLink tx={r.allocation_signature} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                </tr>
              ))}
              {d.receipts.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Nothing received yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
