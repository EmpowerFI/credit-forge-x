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
import StatusPill from "../../components/product/StatusPill";
import FundingBar from "../investor/FundingBar";
import { fundingLine, isRaising, STAGE, type DeskFunding, type DeskLoan, type DeskOpportunity, type DeskStage } from "../../lib/partner";
import { money } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { useDecide, useRecordPayment, useTransition } from "./queries";

export function StagePill({ stage }: { stage: DeskStage }) {
  return <StatusPill tone={STAGE[stage].tone}>{STAGE[stage].label}</StatusPill>;
}

/** Where the capital for one opportunity stands: raised by investors, or the partner's own. */
export function FundingSummary({ funding, compact = false }: { funding: DeskFunding; compact?: boolean }) {
  const line = fundingLine(funding);
  const listed = funding.status && funding.status !== "closed" && funding.target_micro_usdc;
  return (
    <div className="min-w-0 space-y-1.5">
      {listed && !compact && funding.status !== "refunded" && (
        <FundingBar funded={funding.funded_micro_usdc} target={funding.target_micro_usdc} investors={funding.investors} />
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

/** The partner's decision on a referred opportunity: approve at a price and term, or decline. */
export function DecisionForm({ o }: { o: DeskOpportunity }) {
  const [amount, setAmount] = useState(String(o.amount_cents / 100));
  const [rate, setRate] = useState("3.0");
  const [term, setTerm] = useState(String(o.term_months));
  const [reason, setReason] = useState("");
  const decide = useDecide();
  const id = o.opportunity_id;
  const amountCents = Math.round(Number(amount) * 100);
  const invalid = !(amountCents >= 10000 && amountCents <= o.amount_cents) || !(Number(rate) >= 0 && Number(rate) <= 10)
    || !(Number(term) >= 1 && Number(term) <= 24);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`a-${id}`}>Amount (R$)</Label>
          <Input id={`a-${id}`} type="number" inputMode="decimal" min={100} max={o.amount_cents / 100} step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`r-${id}`}>Your rate (% a month)</Label>
          <Input id={`r-${id}`} type="number" inputMode="decimal" min={0} max={10} step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`t-${id}`}>Term (months)</Label>
          <Input id={`t-${id}`} type="number" inputMode="numeric" min={1} max={24} value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>
      <Textarea aria-label="Reason" rows={2} maxLength={500} placeholder="Note or reason (shared with EmpowerFI)"
        value={reason} onChange={(e) => setReason(e.target.value)} />
      {invalid && (
        <p className="text-xs text-caution">The amount runs from R$ 100 up to the {money(o.amount_cents)} qualified; the rate from 0 to 10% a month; the term from 1 to 24 months.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={decide.isPending || invalid} className="gap-2"
          onClick={() => decide.mutate({ opportunityId: id, verdict: "approved", amountCents, rateBps: Math.round(Number(rate) * 100), termMonths: Number(term), reason })}>
          {decide.isPending && decide.variables?.verdict === "approved" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve
        </Button>
        <Button variant="outline" disabled={decide.isPending} className="gap-2"
          onClick={() => decide.mutate({ opportunityId: id, verdict: "declined", reason })}>
          {decide.isPending && decide.variables?.verdict === "declined" ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Decline
        </Button>
      </div>
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

/** What the partner can do next with a loan, and why a step is not open yet. */
export function LoanActions({ loan, decides }: { loan: DeskLoan; decides: boolean }) {
  const move = useTransition();
  const pay = useRecordPayment();
  const [declining, setDeclining] = useState(false);
  if (!decides) return null;
  const busy = move.isPending || pay.isPending;
  const next = loan.schedule.find((s) => !s.payment_id);
  const spin = (on: boolean) => on && <Loader2 size={14} className="animate-spin" />;

  if (loan.status === "PARTNER_APPROVED") {
    const raising = isRaising(loan.funding);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || raising} className="gap-1.5" title={raising ? "Investors are still funding it" : undefined}
          onClick={() => move.mutate({ loanId: loan.id, to: "DISBURSED", note: "Contract signed; Pix sent" })}>
          {spin(move.isPending && move.variables?.to === "DISBURSED") || <Banknote size={14} />} Formalise and disburse
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>Decline</Button>
        {raising && <span className="text-xs text-muted-foreground">Disbursing opens once investors have funded it.</span>}
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
