import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, ExternalLink, FileText, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { shortDate } from "../../lib/community";
import { describeError } from "../../lib/errors";
import { platform } from "../../lib/platform";
import { checkOnChain, fetchSharedReport, reportUrl, type ReportChecks, type ReportRow } from "../../lib/report";
import { rpc, vaultAddress } from "../../lib/solana";
import { rerun } from "./rerun";

const STEPS = [
  "Re-running the latest decisions through the engines in this page",
  "Reading the vault's balance on Solana",
  "Freezing the console's figures into a report",
  "Looking up the report's proofs and transfers on Solana",
] as const;

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success("Link copied.");
}

/** A report's checks, in a line: what the auditor's browser found when it was made. */
function ChecksLine({ checks }: { checks: ReportChecks }) {
  const c = checks.chain;
  const vaultOk = checks.vault && checks.vault.chain_micro_usdc === checks.vault.expected_micro_usdc;
  return (
    <span className="flex flex-wrap gap-1.5">
      {checks.models && (
        <StatusPill tone={checks.models.reproduced === checks.models.checked ? "positive" : "alert"} dot={false}>
          {checks.models.reproduced}/{checks.models.checked} decisions reproduced
        </StatusPill>
      )}
      {c && (
        <StatusPill tone={c.proofs.problems.length === 0 ? "positive" : "alert"} dot={false}>
          {c.proofs.commitment_found}/{c.proofs.checked} proofs found on chain
        </StatusPill>
      )}
      {checks.vault && <StatusPill tone={vaultOk ? "positive" : "alert"} dot={false}>vault {vaultOk ? "matches" : "differs"}</StatusPill>}
    </span>
  );
}

/**
 * Reports an auditor can share by link. Making one freezes the console's
 * figures, runs the checks this browser can run, and records both; whoever
 * opens the link sees them and can run the chain checks again themselves.
 */
export default function Reports() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("EmpowerFI audit report");
  const [step, setStep] = useState(-1);
  const [detail, setDetail] = useState("");
  const [made, setMade] = useState<{ token: string } | null>(null);

  const reports = useQuery({
    queryKey: ["platform", "audit-reports"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_reports");
      if (error) throw error;
      return data as unknown as ReportRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      setMade(null);
      setStep(0);
      const runs = await rerun();
      const at = new Date().toISOString();
      setStep(1);
      const vault = await vaultAddress();
      const chainMicro = await rpc.getTokenAccountBalance(vault, { commitment: "confirmed" }).send()
        .then(({ value }) => Number(value.amount)).catch(() => null);
      const { data: sys, error: sysError } = await platform.rpc("audit_system");
      if (sysError) throw sysError;
      const expected = (sys as { vault: { expected_micro_usdc: number } }).vault.expected_micro_usdc;
      setStep(2);
      const checks: ReportChecks = {
        models: { checked: runs.length, reproduced: runs.filter((r) => r.ok).length, at },
        vault: { address: vault, chain_micro_usdc: chainMicro, expected_micro_usdc: expected, at: new Date().toISOString() },
      };
      const { data, error } = await platform.rpc("create_audit_report", { p_title: title, p_checks: checks as never });
      if (error) throw error;
      const created = data as unknown as { id: string; token: string };
      setStep(3);
      const report = await fetchSharedReport(created.token);
      const chain = await checkOnChain(report.snapshot, setDetail);
      const { error: checkError } = await platform.rpc("record_audit_report_checks", { p_id: created.id, p_checks: { chain } as never });
      if (checkError) throw checkError;
      return created;
    },
    onSuccess: (r) => {
      setStep(STEPS.length);
      setMade(r);
      toast.success("Report ready to share.");
      queryClient.invalidateQueries({ queryKey: ["platform", "audit-reports"] });
    },
    onError: (e) => {
      setStep(-1);
      toast.error(describeError(e));
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await platform.rpc("revoke_audit_report", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link closed.");
      queryClient.invalidateQueries({ queryKey: ["platform", "audit-reports"] });
    },
    onError: (e) => toast.error(describeError(e)),
  });

  return (
    <div className="space-y-6">
      <Panel title="Share an audit report"
        description="Freezes what this console shows — proofs, models, consent enforcement, the vault's ledger, settlement and the Zcash treasury — into a page anyone can open by link, without an account. It holds no name, no participant code, no record's content and no viewing key.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
            <Label htmlFor="report-title">Title</Label>
            <Input id="report-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Button disabled={create.isPending || !title.trim()} onClick={() => create.mutate()} className="gap-2">
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Check and create report
          </Button>
        </div>
        {step >= 0 && (
          <ol className="space-y-2 text-sm" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-start gap-2">
                {i < step ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive" />
                  : i === step && create.isPending ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-info" />
                  : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" aria-hidden />}
                <span className={i <= step ? "text-foreground" : "text-muted-foreground"}>
                  {s}{i === 3 && i === step && detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
        {made && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border tone-positive p-3 text-sm">
            <Check size={16} /> <span className="min-w-0 flex-1 truncate font-mono text-xs">{reportUrl(made.token)}</span>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(reportUrl(made.token))}><Copy size={14} /> Copy link</Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/app/report/${made.token}`} target="_blank" className="gap-1.5">Open <ExternalLink size={14} /></Link>
            </Button>
          </div>
        )}
      </Panel>

      <Panel title="Reports" description="Every report made, newest first. Closing a link makes the report unreachable; the figures in it never change after it is made.">
        {reports.isError ? <LoadError compact error={reports.error} onRetry={() => reports.refetch()} />
          : !reports.data ? <Skeleton className="h-24 w-full" />
          : reports.data.length === 0 ? <p className="text-sm text-muted-foreground">No report yet.</p> : (
            <ul className="divide-y divide-border">
              {reports.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{r.title}</span>
                      {r.revoked_at ? <StatusPill tone="neutral">Link closed</StatusPill> : <StatusPill tone="positive">Shared by link</StatusPill>}
                    </p>
                    <p className="text-xs text-muted-foreground">{shortDate(r.created_at)} · {r.created_by ?? "—"} · {r.proofs} proofs</p>
                    <ChecksLine checks={r.checks} />
                  </div>
                  {!r.revoked_at && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(reportUrl(r.token))}><Copy size={14} /> Copy link</Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/app/report/${r.token}`} target="_blank" className="gap-1.5">Open <ExternalLink size={14} /></Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="gap-1.5"><XCircle size={14} /> Close link</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Close this report's link?</AlertDialogTitle>
                            <AlertDialogDescription>Anyone holding the link will no longer be able to open it. This cannot be undone; you can make a new report.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it open</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revoke.mutate(r.id)}>Close link</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
      </Panel>
    </div>
  );
}
