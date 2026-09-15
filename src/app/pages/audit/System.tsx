import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { fetchPlatformConfig, findConfigPda } from "@empowerfi/audit-client";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { PROGRAM_ID, rpc, sol, usdc, vaultAddress } from "../../lib/solana";
import { useSystemAudit } from "./queries";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`;
};

const JOB_PURPOSE: Record<string, string> = {
  "dispatch-anchor-jobs": "Sends queued proofs to Solana",
  "reconcile-anchors": "Re-reads confirmed proofs from Solana and compares",
  "vault-refunds": "Returns investors' USDC from the vault when owed",
};

/** What Solana itself says, read here: the vault's USDC and the operator's SOL. */
async function readChain() {
  const vault = await vaultAddress();
  const [config] = await findConfigPda();
  const [balance, platform] = await Promise.all([
    rpc.getTokenAccountBalance(vault, { commitment: "confirmed" }).send().then(({ value }) => BigInt(value.amount)).catch(() => null),
    fetchPlatformConfig(rpc, config),
  ]);
  const { value: lamports } = await rpc.getBalance(platform.data.operator, { commitment: "confirmed" }).send();
  return { vault, vaultMicro: balance, operator: platform.data.operator as string, operatorLamports: lamports };
}

/** The machinery behind the proofs: queues, reconciliation, refunds, the vault and the jobs that drive them. */
export default function System() {
  const q = useSystemAudit();
  const chain = useQuery({ queryKey: ["audit-chain"], queryFn: readChain, refetchInterval: 30_000 });

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const d = q.data;
  const queued = d.anchors.pending + d.anchors.submitted;
  const flagged = d.reconcile.missing + d.reconcile.mismatch;
  const vaultMatches = chain.data?.vaultMicro !== null && chain.data?.vaultMicro !== undefined
    ? chain.data.vaultMicro === BigInt(d.vault.expected_micro_usdc) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Proofs queued" value={queued} hint={queued ? `oldest ${ago(d.anchors.oldest_queued_at)}` : "queue empty"} hintTone={queued ? "caution" : "positive"} />
        <StatTile label="Last proof confirmed" value={ago(d.anchors.last_confirmed_at)} hint={`${d.anchors.confirmed} in total`} />
        <StatTile label="Flagged by reconciliation" value={flagged} hint={`${d.reconcile.verified} verified`} hintTone={flagged ? "alert" : "positive"} />
        <StatTile label="Refunds owed" value={d.refunds.due + d.refunds.sending} hint={`${d.refunds.refunded} sent`} hintTone={d.refunds.due + d.refunds.sending ? "caution" : "positive"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="The vault" description="Investors' USDC, held by the program. What Solana says it holds, against what the database says it should.">
          <dl className="divide-y divide-border text-sm">
            <Row label="On Solana">
              {chain.isPending ? "Reading devnet…" : chain.data?.vaultMicro === null ? "No account yet" : chain.data ? usdc(chain.data.vaultMicro) : "—"}
              {chain.data && <span className="ml-2"><ExplorerLink address={chain.data.vault} /></span>}
            </Row>
            <Row label="Should hold">{usdc(d.vault.expected_micro_usdc)} <span className="text-xs text-muted-foreground">allocated, or owed back and not yet sent</span></Row>
            <Row label="Deposited">{usdc(d.vault.deposited_micro_usdc)} in {d.vault.deposits} deposit{d.vault.deposits === 1 ? "" : "s"}</Row>
            <Row label="Refunded">{usdc(d.vault.refunded_micro_usdc)}</Row>
          </dl>
          <p className={`flex items-center gap-2 text-sm ${vaultMatches === null ? "text-muted-foreground" : vaultMatches ? "text-positive" : "text-caution"}`}>
            {vaultMatches === null ? <CircleDashed size={16} /> : vaultMatches ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {vaultMatches === null ? "Comparing with Solana…"
              : vaultMatches ? "The vault holds exactly what the database accounts for."
              : "The vault and the database differ: a transfer not recorded here, or one on its way."}
          </p>
          {chain.isError && <p className="text-xs text-alert">Could not read devnet: {(chain.error as Error).message}</p>}
        </Panel>

        <Panel title="Program and operator" description="The one program every proof and transfer goes through, and the key that signs for the platform.">
          <dl className="divide-y divide-border text-sm">
            <Row label="Program"><ExplorerLink address={PROGRAM_ID} /> <span className="text-xs text-muted-foreground">Solana Devnet</span></Row>
            <Row label="Operator">{chain.data ? <ExplorerLink address={chain.data.operator} /> : "…"}</Row>
            <Row label="Operator balance">{chain.data ? sol(chain.data.operatorLamports) : "…"} <span className="text-xs text-muted-foreground">pays for each proof's account and fee</span></Row>
            <Row label="Last anchoring error">{d.anchors.last_error ? <span className="text-xs text-alert">{d.anchors.last_error}</span> : <span className="text-xs text-muted-foreground">none</span>}</Row>
            <Row label="Last refund error">{d.refunds.last_error ? <span className="text-xs text-alert">{d.refunds.last_error}</span> : <span className="text-xs text-muted-foreground">none</span>}</Row>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Reconciliation" description="Every confirmed proof is re-read from Solana and compared with the record as it is now, at least once a day.">
          <dl className="divide-y divide-border text-sm">
            <Row label="Verified">{d.reconcile.verified}</Row>
            <Row label="Awaiting a check">{d.reconcile.unchecked}</Row>
            <Row label="Missing on chain"><span className={d.reconcile.missing ? "text-alert" : ""}>{d.reconcile.missing}</span></Row>
            <Row label="Changed since">{<span className={d.reconcile.mismatch ? "text-alert" : ""}>{d.reconcile.mismatch}</span>}</Row>
            <Row label="Last check">{ago(d.reconcile.last_at)}</Row>
          </dl>
        </Panel>

        <Panel title="Scheduled jobs" description="Run by the database (pg_cron), each calling an Edge Function.">
          {!d.jobs ? <p className="text-sm text-muted-foreground">The job list is not readable here.</p> : (
            <ul className="divide-y divide-border text-sm">
              {d.jobs.map((j) => (
                <li key={j.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="block font-mono text-xs text-foreground">{j.name}</span>
                    <span className="text-xs text-muted-foreground">{JOB_PURPOSE[j.name] ?? ""}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{j.schedule === "* * * * *" ? "every minute" : `every ${j.schedule}`}</span>
                    <StatusPill tone={j.active ? "positive" : "neutral"}>{j.active ? "Active" : "Paused"}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
