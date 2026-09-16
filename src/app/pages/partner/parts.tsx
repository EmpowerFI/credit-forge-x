import { useState } from "react";
import { Banknote, Check, Loader2, PlayCircle, Receipt, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { REASON, type AllocationReason } from "../../lib/capital";
import FundingBar from "../investor/FundingBar";
import { fundingLine, rate, STAGE, type DeskFunding, type DeskLoan, type DeskOpportunity, type DeskStage } from "../../lib/partner";
import { money } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { useDecline, useFormaliseAndDisburse, useRecordPayment, useTransition } from "./queries";

export function StagePill({ stage }: { stage: DeskStage }) {
  return <StatusPill tone={STAGE[stage].tone}>{STAGE[stage].label}</StatusPill>;
}

/** Where the capital for one opportunity stands: its pool, and how far investors have funded it. */
export function FundingSummary({ funding, compact = false, amountCents = null }: { funding: DeskFunding; compact?: boolean; amountCents?: number | null }) {
  const line = fundingLine(funding);
  const listed = funding.status && funding.status !== "closed" && funding.target_micro_usdc;
  const lead = (funding.reason_codes ?? [])[0] as AllocationReason | undefined;
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <PoolPill pool={funding.pool} />
        {!compact && lead && <span>{REASON[lead].label}</span>}
      </p>
      {listed && !compact && funding.status !== "refunded" && (
        <FundingBar funded={funding.funded_micro_usdc} target={funding.target_micro_usdc} investors={funding.investors}
          pool={funding.pool} fxMilli={funding.fx_brl_per_usdc_milli} amountCents={amountCents} />
      )}
      <p className="text-xs text-muted-foreground">
        <StatusPill tone={line.tone} dot={!compact}>{line.label}</StatusPill>
        {!compact && funding.real_micro_usdc > 0 && (
          <span className="ml-2">{usdc(funding.real_micro_usdc)} of it real devnet USDC, the rest simulated</span>
        )}
      </p>
    </div>
  );
}

/** Declining before a loan exists: a reason, and what it does to her investors, before anything happens. */
function DeclineOpportunityDialog({ o, open, onOpenChange }: { o: DeskOpportunity; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [reason, setReason] = useState("");
  const decline = useDecline();
  const f = o.funding;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Decline {o.participant}'s request</DialogTitle>
          <DialogDescription>No loan is formalised. The opportunity leaves the market.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {f.funded_micro_usdc > 0 ? (
            <p className="rounded-lg border tone-caution p-3">
              {f.investors} investor{f.investors === 1 ? "" : "s"} put capital into it. Every allocation is refunded:
              {f.real_micro_usdc > 0 ? ` ${usdc(f.real_micro_usdc)} of real devnet USDC goes back from the vault to their wallets on its own,` : ""} simulated positions are closed.
            </p>
          ) : (
            <p className="text-muted-foreground">No investor capital is in it: nothing to refund.</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`why-o-${o.opportunity_id}`}>Reason</Label>
            <Textarea id={`why-o-${o.opportunity_id}`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="For example: documents incomplete, guarantor not reached" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep it</Button>
          <Button variant="destructive" disabled={!reason.trim() || decline.isPending}
            onClick={() => decline.mutate({ opportunityId: o.opportunity_id, reason: reason.trim() }, { onSuccess: () => onOpenChange(false) })}>
            {decline.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} Decline and refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the desk can do with an opportunity before a loan exists: formalise it once funded, or decline it. */
export function OpportunityActions({ o, decides }: { o: DeskOpportunity; decides: boolean }) {
  const formalise = useFormaliseAndDisburse();
  const [declining, setDeclining] = useState(false);
  if (!decides || o.status !== "referred") return null;
  const funded = o.funding.status === "funded";
  const listed = Boolean(o.funding.status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={!funded || formalise.isPending} className="gap-1.5" title={funded ? undefined : "Investors have not funded it yet"}
        onClick={() => formalise.mutate({ opportunityId: o.opportunity_id })}>
        {formalise.isPending ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} Formalise and disburse
      </Button>
      <Button size="sm" variant="ghost" disabled={formalise.isPending} onClick={() => setDeclining(true)}>Decline</Button>
      {!funded && (
        <span className="text-xs text-muted-foreground">
          {listed ? "Formalising opens once investors have funded it." : "No pool can fund it yet."}
          {o.funding.rate_bps_month !== null && ` It will carry ${rate(o.funding.rate_bps_month)}, the engine's rate.`}
        </span>
      )}
      {funded && o.funding.rate_bps_month !== null && (
        <span className="text-xs text-muted-foreground">At {rate(o.funding.rate_bps_month)}: {o.term_months} × {money(o.funding.instalment_cents)}.</span>
      )}
      <DeclineOpportunityDialog o={o} open={declining} onOpenChange={setDeclining} />
    </div>
  );
}

/** Declining at formalisation: a reason, and what it does to her investors, before anything happens. */
function DeclineDialog({ loan, open, onOpenChange }: { loan: DeskLoan; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [reason, setReason] = useState("");
  const move = useTransition();
  const f = loan.funding;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Decline at formalisation</DialogTitle>
          <DialogDescription>
            {loan.participant}'s loan of {money(loan.principal_cents)} will not be signed. The opportunity closes and is proven cancelled on Solana.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {f.status && f.funded_micro_usdc > 0 ? (
            <p className="rounded-lg border tone-caution p-3">
              {f.investors} investor{f.investors === 1 ? "" : "s"} put {usdc(f.funded_micro_usdc)} into it. Every allocation is refunded:
              {f.real_micro_usdc > 0 ? ` ${usdc(f.real_micro_usdc)} of real devnet USDC goes back from the vault to their wallets on its own,` : ""} simulated positions are closed.
            </p>
          ) : (
            <p className="text-muted-foreground">No investor capital is in it: nothing to refund.</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`why-${loan.id}`}>Reason</Label>
            <Textarea id={`why-${loan.id}`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="For example: documents incomplete, guarantor not reached" />
            <p className="text-xs text-muted-foreground">Her investors see this reason on their position.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep the loan</Button>
          <Button variant="destructive" disabled={!reason.trim() || move.isPending}
            onClick={() => move.mutate({ loanId: loan.id, to: "CANCELLED", note: reason.trim() }, { onSuccess: () => onOpenChange(false) })}>
            {move.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} Decline and refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the desk can do next with a loan. */
export function LoanActions({ loan, decides }: { loan: DeskLoan; decides: boolean }) {
  const move = useTransition();
  const pay = useRecordPayment();
  const [declining, setDeclining] = useState(false);
  if (!decides) return null;
  const busy = move.isPending || pay.isPending;
  const next = loan.schedule.find((s) => !s.payment_id);
  const spin = (on: boolean) => on && <Loader2 size={14} className="animate-spin" />;

  if (loan.status === "PARTNER_APPROVED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} className="gap-1.5"
          onClick={() => move.mutate({ loanId: loan.id, to: "DISBURSED", note: "Contract signed; Pix sent" })}>
          {spin(move.isPending && move.variables?.to === "DISBURSED") || <Banknote size={14} />} Disburse
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>Decline</Button>
        <DeclineDialog loan={loan} open={declining} onOpenChange={setDeclining} />
      </div>
    );
  }
  if (loan.status === "DISBURSED") {
    return (
      <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => move.mutate({ loanId: loan.id, to: "ACTIVE" })}>
        {spin(move.isPending) || <PlayCircle size={14} />} Start repayment
      </Button>
    );
  }
  if (loan.status === "ACTIVE") {
    return (
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button size="sm" disabled={busy} className="gap-1.5"
            onClick={() => pay.mutate({ loanId: loan.id, n: next.instalment_no, cents: loan.instalment_cents })}>
            {spin(pay.isPending) || <Receipt size={14} />} Record instalment {next.instalment_no}
          </Button>
        )}
        {!next && (
          <Button size="sm" disabled={busy} onClick={() => move.mutate({ loanId: loan.id, to: "PAID", note: "All instalments received" })}>
            {spin(move.isPending)} Mark paid off
          </Button>
        )}
        {loan.overdue > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={busy}>Mark defaulted</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark {loan.participant}'s loan defaulted?</AlertDialogTitle>
                <AlertDialogDescription>
                  {loan.overdue} instalment{loan.overdue === 1 ? " is" : "s are"} overdue. A default is final: it is proven on Solana, her investors see it on
                  their positions, and no further instalments can be recorded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep following up</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => move.mutate({ loanId: loan.id, to: "DEFAULTED", note: `${loan.overdue} instalment${loan.overdue === 1 ? "" : "s"} overdue` })}>
                  Mark defaulted
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    );
  }
  return null;
}
