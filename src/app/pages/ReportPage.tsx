import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Loader2, Printer, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../components/LoadError";
import DataLegend from "../components/product/DataLegend";
import ExplorerLink from "../components/product/ExplorerLink";
import NetworkBadge from "../components/product/NetworkBadge";
import Panel from "../components/product/Panel";
import StatTile from "../components/product/StatTile";
import StatusPill from "../components/product/StatusPill";
import { PROOF_KIND_LABEL } from "../lib/audit";
import { shortDate } from "../lib/community";
import { LOAN_LABEL, type LoanStatus } from "../lib/credit";
import type { AnchorKind } from "../lib/platform";
import { checkOnChain, fetchSharedReport, type ChainCheck, type SharedReport } from "../lib/report";
import { money } from "../lib/readiness";
import { usdc } from "../lib/solana";
import { zcashExplorerTx, zec } from "../lib/zcash";

const CONSENT_CHECK: Record<string, string> = {
  assessed_without_consent: "Readiness assessed without consent",
  eligibility_without_consent: "Eligibility assessed without consent",
  referred_without_consent: "Referred to a partner without consent",
  listed_without_consent: "Shown to investors without consent",
};
const LEG_LABEL: Record<string, string> = {
  release: "Releases to the ramp", payout: "Payouts to investors", pix_payout: "Pix to her business (mock)", pix_in: "Pix instalments in (mock)",
};

const at = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";
const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-6)}`;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="num text-right text-foreground">{children}</span>
    </div>
  );
}

function Verdict({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      {ok === null ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-caution" />
        : ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-alert" />}
      <span className="text-foreground">{children}</span>
    </p>
  );
}

function ChainResult({ c, expected, title }: { c: ChainCheck; expected: number; title: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title} · {at(c.at)}</p>
      {c.proofs.checked === 0 ? <Verdict ok={null}>No proof had reached Solana yet when the report was made</Verdict> : (
        <>
          <Verdict ok={c.proofs.landed === c.proofs.checked}>{c.proofs.landed} of {c.proofs.checked} proof transactions landed on Solana</Verdict>
          <Verdict ok={c.proofs.commitment_found === c.proofs.checked}>
            {c.proofs.commitment_found} of {c.proofs.checked} commitments found where the program wrote them
          </Verdict>
        </>
      )}
      {c.transfers.checked > 0 && (
        <Verdict ok={c.transfers.landed === c.transfers.checked}>{c.transfers.landed} of {c.transfers.checked} vault transactions landed</Verdict>
      )}
      <Verdict ok={c.vault.chain_micro_usdc === null ? null : c.vault.chain_micro_usdc === expected}>
        The vault holds {c.vault.chain_micro_usdc === null ? "no account yet" : usdc(c.vault.chain_micro_usdc)}; the ledger says {usdc(expected)}
        {c.vault.chain_micro_usdc !== null && c.vault.chain_micro_usdc !== expected && " (it may have moved since the report was made)"}
      </Verdict>
      {c.proofs.problems.length > 0 && (
        <ul className="space-y-1 text-xs text-alert">
          {c.proofs.problems.slice(0, 10).map((p) => <li key={p.signature}>{PROOF_KIND_LABEL[p.kind as AnchorKind] ?? p.kind}: {p.issue} · <ExplorerLink tx={p.signature} /></li>)}
        </ul>
      )}
    </div>
  );
}

function download(report: SharedReport, mine: ChainCheck | null) {
  const body = JSON.stringify({ ...report, reader_checks: mine }, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `empowerfi-audit-report-${report.created_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * An audit report opened by its link: no account needed. The figures are the
 * auditor's snapshot; the chain checks can be run again here, from this
 * browser, against Solana directly.
 */
export default function ReportPage() {
  const { token = "" } = useParams();
  const report = useQuery({ queryKey: ["shared-report", token], queryFn: () => fetchSharedReport(token), retry: false });
  const [progress, setProgress] = useState("");
  const recheck = useMutation({ mutationFn: () => checkOnChain(report.data!.snapshot, setProgress) });

  const header = (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <span className="hidden font-heading text-base font-semibold text-foreground sm:block">Audit report</span>
        </div>
        <NetworkBadge />
      </div>
    </header>
  );

  if (report.isPending) {
    return <div className="min-h-screen bg-background">{header}<main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6"><Skeleton className="h-24" /><Skeleton className="h-72" /></main></div>;
  }
  if (report.isError) {
    const gone = (report.error as { message?: string }).message === "report_not_found";
    return (
      <div className="min-h-screen bg-background">{header}
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          {gone ? (
            <Panel title="This report is not available">
              <p className="text-sm text-muted-foreground">The link is wrong, or the auditor who shared it has closed it. Ask them for a new one.</p>
            </Panel>
          ) : <LoadError error={report.error} onRetry={() => report.refetch()} />}
        </main>
      </div>
    );
  }

  const { title, created_at, snapshot: s, checks } = report.data;
  const consentClean = Object.values(s.consent.checks).every((n) => n === 0);
  const kinds = Object.entries(s.anchors.by_kind).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest text-accent">EmpowerFI · audit report</p>
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Made by an EmpowerFI auditor on {at(created_at)}. Demo data on Solana devnet: every figure is simulated or devnet, and no real money moved.
            </p>
            <DataLegend />
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => download(report.data, recheck.data ?? null)}><Download size={15} /> JSON</Button>
            <Button variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer size={15} /> Print or save as PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Proofs on Solana" value={s.anchors.confirmed} hint={`${s.anchors.queued} queued`} />
          <StatTile label="Re-read from chain" value={s.anchors.verified} hint={`${s.anchors.mismatch + s.anchors.missing} disagree`}
            hintTone={s.anchors.mismatch + s.anchors.missing ? "alert" : "positive"} />
          <StatTile label="Decisions reproduced" value={checks.models ? `${checks.models.reproduced}/${checks.models.checked}` : "—"} hint="in the auditor's browser"
            hintTone={checks.models && checks.models.reproduced === checks.models.checked ? "positive" : "neutral"} />
          <StatTile label="Consent breaches" value={Object.values(s.consent.checks).reduce((a, b) => a + b, 0)} hint="enforcement checks" hintTone={consentClean ? "positive" : "alert"} />
          <StatTile label="Vault, expected" value={usdc(s.vault.expected_micro_usdc)} hint="devnet USDC" />
          <StatTile label="Lent by partners" value={money(s.credit.lent_cents)} hint="simulated" />
        </div>

        <Panel title="Check it yourself" actions={(
          <Button className="no-print gap-1.5" disabled={recheck.isPending} onClick={() => recheck.mutate()}>
            {recheck.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Check on Solana now
          </Button>
        )} description="This page asks Solana directly, from your browser, whether each proof's transaction landed and whether its commitment is where the program wrote it; it reads the vault's balance too. A commitment is a hash: it proves a record existed unchanged, without revealing it.">
          <div className="grid gap-6 md:grid-cols-2">
            {checks.chain ? <ChainResult c={checks.chain} expected={s.vault.expected_micro_usdc} title="The auditor's check" />
              : <p className="text-sm text-muted-foreground">The auditor's browser did not record a chain check.</p>}
            {recheck.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> {progress}</p>
              : recheck.isError ? <LoadError compact error={recheck.error} onRetry={() => recheck.mutate()} />
              : recheck.data ? <ChainResult c={recheck.data} expected={s.vault.expected_micro_usdc} title="Your check" />
              : <p className="text-sm text-muted-foreground">Run it to compare with the auditor's.</p>}
          </div>
          <div className="grid gap-x-6 text-xs sm:grid-cols-3">
            <Row label="Program"><ExplorerLink address={s.chain.program_id} /></Row>
            <Row label="Vault">{checks.vault ? <ExplorerLink address={checks.vault.address} /> : "—"}</Row>
            <Row label="USDC mint (Circle devnet)"><ExplorerLink address={s.chain.usdc_mint} /></Row>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Proofs by kind" description="Every fact EmpowerFI records is committed on Solana. The reconciler re-reads each one from the chain and compares.">
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border"><th className="py-2 pr-4 font-medium">Kind</th><th className="py-2 pr-4 text-right font-medium">Recorded</th><th className="py-2 pr-4 text-right font-medium">On chain</th><th className="py-2 text-right font-medium">Re-read</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {kinds.map(([k, v]) => (
                    <tr key={k}><td className="py-2 pr-4 text-foreground">{PROOF_KIND_LABEL[k as AnchorKind] ?? k}</td><td className="num py-2 pr-4 text-right">{v.total}</td><td className="num py-2 pr-4 text-right">{v.confirmed}</td><td className="num py-2 text-right text-positive">{v.verified}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">First proof {at(s.anchors.first_confirmed_at)} · latest {at(s.anchors.last_confirmed_at)} · last re-read {at(s.anchors.last_reconciled_at)}</p>
          </Panel>

          <Panel title="Consent, enforced" description="Each use of her data needs her consent in force at the time. Every check should read 0.">
            {Object.entries(s.consent.checks).map(([k, n]) => (
              <Verdict key={k} ok={n === 0}>{CONSENT_CHECK[k] ?? k}: {n}</Verdict>
            ))}
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Row label="Enrolled">{s.consent.enrolled}</Row>
              <Row label="With a consent record">{s.consent.with_record}</Row>
              <Row label="Records (changes)">{s.consent.records} ({s.consent.changes})</Row>
              <Row label="Proven on Solana">{s.consent.anchored}</Row>
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Models" description="The rule engines behind each decision, by version. The auditor re-ran the latest decisions through the same engines in the browser.">
            {(["readiness", "eligibility", "outcome"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{k}</p>
                {s.models[k].length === 0 ? <p className="text-sm text-muted-foreground">Not run.</p> : s.models[k].map((m) => (
                  <Row key={m.version} label={m.version}>{m.runs} runs · {m.anchored} on chain</Row>
                ))}
              </div>
            ))}
          </Panel>

          <Panel title="From readiness to credit" description="Counts only: who is who stays private.">
            <Row label="Verified communities">{s.credit.communities}</Row>
            <Row label="Participants">{s.credit.participants}</Row>
            <Row label="Credit ready now">{s.credit.credit_ready}</Row>
            <Row label="Eligibility assessments">{Object.entries(s.credit.eligibility).map(([k, n]) => `${k.toLowerCase().replace(/_/g, " ")} ${n}`).join(" · ") || "—"}</Row>
            <Row label="Referred to a partner">{s.credit.referred}</Row>
            <Row label="Partner decisions">{Object.entries(s.credit.decisions).map(([k, n]) => `${k} ${n}`).join(" · ") || "—"}</Row>
            <Row label="Loans">{Object.entries(s.credit.loans).map(([k, n]) => `${LOAN_LABEL[k as LoanStatus]?.toLowerCase() ?? k} ${n}`).join(" · ") || "—"}</Row>
            <Row label="Instalments received">{s.credit.instalments} · {money(s.credit.repaid_cents)}</Row>
            <Row label="Outcomes measured">{s.credit.outcomes}</Row>
          </Panel>
        </div>

        <Panel title="The vault and settlement" description="Investors' devnet USDC in the program's vault, and every transaction that moved it. Deposits never name the opportunity they fund.">
          <div className="grid gap-x-8 md:grid-cols-2">
            <div>
              <Row label="Deposited by wallet and credited for ZEC">{usdc(s.vault.deposits_micro_usdc)} · {s.vault.deposits} deposits</Row>
              <Row label="From shielded ZEC">{usdc(s.vault.zcash_micro_usdc)}</Row>
              <Row label="Refunded">{usdc(s.vault.refunded_micro_usdc)} · {s.vault.refunded}</Row>
              <Row label="Released to the ramp">{usdc(s.vault.released_micro_usdc)}</Row>
              <Row label="Paid out to investors">{usdc(s.vault.paid_out_micro_usdc)} ({usdc(s.vault.repaid_in_micro_usdc)} in)</Row>
              <Row label="Should hold">{usdc(s.vault.expected_micro_usdc)}</Row>
              <Row label="Simulated positions (no USDC)">{s.vault.simulated_positions}</Row>
            </div>
            <div>
              {Object.entries(s.settlement.legs).sort().map(([k, n]) => {
                const [kind, status] = k.split(":");
                return <Row key={k} label={`${LEG_LABEL[kind] ?? kind} · ${status}`}>{n}</Row>;
              })}
            </div>
          </div>
          {[...s.settlement.transfers, ...s.settlement.deposits, ...s.settlement.refunds].length > 0 && (
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border"><th className="py-2 pr-4 font-medium">Movement</th><th className="py-2 pr-4 text-right font-medium">USDC</th><th className="py-2 pr-4 font-medium">When</th><th className="py-2 font-medium">Transaction</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {s.settlement.deposits.map((d) => <tr key={d.signature}><td className="py-2 pr-4">Deposit into the vault</td><td className="num py-2 pr-4 text-right">{usdc(d.amount_micro_usdc)}</td><td className="py-2 pr-4 text-xs text-muted-foreground">{shortDate(d.at)}</td><td className="py-2"><ExplorerLink tx={d.signature} /></td></tr>)}
                  {s.settlement.refunds.map((d) => <tr key={d.signature}><td className="py-2 pr-4">Refund from the vault</td><td className="num py-2 pr-4 text-right">{usdc(d.amount_micro_usdc)}</td><td className="py-2 pr-4 text-xs text-muted-foreground">{shortDate(d.at)}</td><td className="py-2"><ExplorerLink tx={d.signature} /></td></tr>)}
                  {s.settlement.transfers.map((t) => (
                    <tr key={t.signature}>
                      <td className="py-2 pr-4">{t.kind === "release" ? "Release to the ramp" : "Payout to investors"}</td>
                      <td className="num py-2 pr-4 text-right">{t.kind === "payout" ? `${usdc(t.inflow_micro_usdc)} in, ${usdc(t.outflow_micro_usdc)} out` : usdc(t.outflow_micro_usdc)}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{shortDate(t.at)}</td>
                      <td className="py-2"><ExplorerLink tx={t.signature} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {s.zcash && (
          <Panel title="Zcash treasury" description="Payments to EmpowerFI's shielded address, as its viewing key reads them. The viewing key is disclosed to auditors only; each note's transaction is public, its amount and memo are not, so the amounts here come from the auditor's view.">
            <div className="grid gap-x-8 md:grid-cols-2">
              <Row label="Network">{s.zcash.network === "test" ? "Zcash testnet" : "Zcash mainnet"}</Row>
              <Row label="Received">{zec(s.zcash.received_zat)} in {s.zcash.receipts.length} notes</Row>
              <Row label="Address"><span className="break-all font-mono text-xs">{short(s.zcash.address)}</span></Row>
              <Row label="Read up to block">{s.zcash.scanned_height ?? "—"} · {s.zcash.confirmations_needed} confirmations needed</Row>
            </div>
            <ul className="divide-y divide-border text-sm">
              {s.zcash.receipts.map((r) => (
                <li key={`${r.txid}-${r.pool}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={zcashExplorerTx(r.txid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
                    {short(r.txid)} <ExternalLink size={11} />
                  </a>
                  <span className="text-xs text-muted-foreground">{r.pool} · block {r.height}</span>
                  <span className="num">{zec(r.value_zat)}</span>
                  {r.credited && r.credit_signature ? <span className="text-xs">credited · <ExplorerLink tx={r.credit_signature} /></span> : <StatusPill tone="neutral" dot={false}>not an allocation</StatusPill>}
                </li>
              ))}
            </ul>
            {(s.zcash.returns ?? []).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Paid back in ZEC</p>
                <ul className="divide-y divide-border text-sm">
                  {s.zcash.returns.map((r) => (
                    <li key={r.txid} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <a href={zcashExplorerTx(r.txid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
                        {short(r.txid)} <ExternalLink size={11} />
                      </a>
                      <span className="text-xs text-muted-foreground">{r.kind === "refund" ? "refund" : "instalment share"} · {shortDate(r.sent_at)}</span>
                      <span className="num">{zec(r.amount_zat)} <span className="text-xs text-muted-foreground">({usdc(r.amount_micro_usdc)})</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        )}

        {s.proofs.length > 0 && <Panel title={`Latest ${s.proofs.length} proofs`} description="Each by its kind, its commitment, the account that holds it and the transaction that wrote it. What each commitment is a hash of stays with EmpowerFI; the auditor can open it, you can check it exists.">
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border"><th className="py-2 pr-4 font-medium">Kind</th><th className="py-2 pr-4 font-medium">Commitment</th><th className="py-2 pr-4 font-medium">Account</th><th className="py-2 pr-4 font-medium">Transaction</th><th className="py-2 font-medium">Confirmed</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.proofs.map((p) => {
                  const bad = recheck.data?.proofs.problems.find((x) => x.signature === p.signature);
                  return (
                    <tr key={p.signature}>
                      <td className="py-2 pr-4 text-foreground">
                        {PROOF_KIND_LABEL[p.kind as AnchorKind] ?? p.kind}
                        {recheck.data && (bad ? <XCircle size={13} className="ml-1.5 inline text-alert" aria-label={bad.issue} /> : <CheckCircle2 size={13} className="ml-1.5 inline text-positive" aria-label="Found on chain" />)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground" title={p.commitment ?? undefined}>{p.commitment ? short(p.commitment) : "—"}</td>
                      <td className="py-2 pr-4">{p.account ? <ExplorerLink address={p.account} /> : "—"}</td>
                      <td className="py-2 pr-4"><ExplorerLink tx={p.signature} /></td>
                      <td className="py-2 text-xs text-muted-foreground">{shortDate(p.confirmed_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>}

        <Panel title="What this report leaves out, on purpose">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>No participant's name, business, community membership or code, and none of her figures.</li>
            <li>No investor's identity or wallet; deposits appear by transaction only, never with what they fund.</li>
            <li>No record behind a commitment, and no Zcash viewing key or memo. An auditor opens those in the console.</li>
            <li>Nothing here is a promise of return or a credit approval: it is a devnet demonstration with simulated data.</li>
          </ul>
        </Panel>
      </main>
    </div>
  );
}
