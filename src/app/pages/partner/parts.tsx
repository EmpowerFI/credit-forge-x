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
import { tr } from "../../i18n";
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
          <span className="ml-2">{tr({
            en: `${usdc(funding.real_micro_usdc)} of it real devnet USDC, the rest simulated`,
            pt: `${usdc(funding.real_micro_usdc)} disso em USDC real na devnet; o resto é simulado`,
          })}</span>
        )}
      </p>
    </div>
  );
}

/** What a decline does to the investors in it, before anything happens. */
function RefundNote({ f, amount }: { f: DeskFunding; amount: boolean }) {
  const real = f.real_micro_usdc > 0;
  const one = f.investors === 1;
  return (
    <p className="rounded-lg border tone-caution p-3">
      {tr({
        en: `${f.investors} investor${one ? "" : "s"} put ${amount ? usdc(f.funded_micro_usdc) : "capital"} into it. Every allocation is refunded:${
          real ? ` ${usdc(f.real_micro_usdc)} of real devnet USDC goes back from the vault to their wallets on its own,` : ""} simulated positions are closed.`,
        pt: `${f.investors} ${one ? "investidor colocou" : "investidores colocaram"} ${amount ? usdc(f.funded_micro_usdc) : "capital"} nela. Toda alocação é reembolsada:${
          real ? ` ${usdc(f.real_micro_usdc)} em USDC real na devnet voltam do cofre para as carteiras dos investidores automaticamente;` : ""} as posições simuladas são encerradas.`,
      })}
    </p>
  );
}

const NOTHING_TO_REFUND = () => tr({ en: "No investor capital is in it: nothing to refund.", pt: "Não há capital de investidores nela: nada a reembolsar." });
const REASON_PLACEHOLDER = () =>
  tr({ en: "For example: documents incomplete, guarantor not reached", pt: "Por exemplo: documentos incompletos, avalista não localizado" });

/** Declining before a loan exists: a reason, and what it does to her investors, before anything happens. */
function DeclineOpportunityDialog({ o, open, onOpenChange }: { o: DeskOpportunity; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [reason, setReason] = useState("");
  const decline = useDecline();
  const f = o.funding;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr({ en: `Decline ${o.participant}'s request`, pt: `Recusar o pedido de ${o.participant}` })}</DialogTitle>
          <DialogDescription>
            {tr({ en: "No loan is formalised. The opportunity leaves the market.", pt: "Nenhum empréstimo é formalizado. A oportunidade sai do mercado." })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {f.funded_micro_usdc > 0 ? <RefundNote f={f} amount={false} /> : (
            <p className="text-muted-foreground">{NOTHING_TO_REFUND()}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`why-o-${o.opportunity_id}`}>{tr({ en: "Reason", pt: "Motivo" })}</Label>
            <Textarea id={`why-o-${o.opportunity_id}`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={REASON_PLACEHOLDER()} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tr({ en: "Keep it", pt: "Manter" })}</Button>
          <Button variant="destructive" disabled={!reason.trim() || decline.isPending}
            onClick={() => decline.mutate({ opportunityId: o.opportunity_id, reason: reason.trim() }, { onSuccess: () => onOpenChange(false) })}>
            {decline.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} {tr({ en: "Decline and refund", pt: "Recusar e reembolsar" })}
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
      <Button size="sm" disabled={!funded || formalise.isPending} className="gap-1.5" title={funded ? undefined : tr({ en: "Investors have not funded it yet", pt: "Ainda não está 100% captada" })}
        onClick={() => formalise.mutate({ opportunityId: o.opportunity_id })}>
        {formalise.isPending ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} {tr({ en: "Formalise and disburse", pt: "Formalizar e desembolsar" })}
      </Button>
      <Button size="sm" variant="ghost" disabled={formalise.isPending} onClick={() => setDeclining(true)}>{tr({ en: "Decline", pt: "Recusar" })}</Button>
      {!funded && (
        <span className="text-xs text-muted-foreground">
          {listed
            ? tr({ en: "Formalising opens once investors have funded it.", pt: "A formalização abre quando ela estiver 100% captada." })
            : tr({ en: "No pool can fund it yet.", pt: "Nenhum pool pode financiá-la ainda." })}
          {o.funding.rate_bps_month !== null
            && tr({ en: ` It will carry ${rate(o.funding.rate_bps_month)}, the engine's rate.`, pt: ` Ela terá ${rate(o.funding.rate_bps_month)}, a taxa do motor.` })}
        </span>
      )}
      {funded && o.funding.rate_bps_month !== null && (
        <span className="text-xs text-muted-foreground">
          {tr({
            en: `At ${rate(o.funding.rate_bps_month)}: ${o.term_months} × ${money(o.funding.instalment_cents)}.`,
            pt: `Com ${rate(o.funding.rate_bps_month)}: ${o.term_months} × ${money(o.funding.instalment_cents)}.`,
          })}
        </span>
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
          <DialogTitle>{tr({ en: "Decline at formalisation", pt: "Recusar na formalização" })}</DialogTitle>
          <DialogDescription>
            {tr({
              en: `${loan.participant}'s loan of ${money(loan.principal_cents)} will not be signed. The opportunity closes and is proven cancelled on Solana.`,
              pt: `O empréstimo de ${money(loan.principal_cents)} para ${loan.participant} não será assinado. A oportunidade é encerrada, e o cancelamento é registrado na Solana.`,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {f.status && f.funded_micro_usdc > 0 ? <RefundNote f={f} amount /> : (
            <p className="text-muted-foreground">{NOTHING_TO_REFUND()}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`why-${loan.id}`}>{tr({ en: "Reason", pt: "Motivo" })}</Label>
            <Textarea id={`why-${loan.id}`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={REASON_PLACEHOLDER()} />
            <p className="text-xs text-muted-foreground">
              {tr({ en: "Her investors see this reason on their position.", pt: "Os investidores dela veem este motivo na posição deles." })}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tr({ en: "Keep the loan", pt: "Manter o empréstimo" })}</Button>
          <Button variant="destructive" disabled={!reason.trim() || move.isPending}
            onClick={() => move.mutate({ loanId: loan.id, to: "CANCELLED", note: reason.trim() }, { onSuccess: () => onOpenChange(false) })}>
            {move.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} {tr({ en: "Decline and refund", pt: "Recusar e reembolsar" })}
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
          {spin(move.isPending && move.variables?.to === "DISBURSED") || <Banknote size={14} />} {tr({ en: "Disburse", pt: "Desembolsar" })}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>{tr({ en: "Decline", pt: "Recusar" })}</Button>
        <DeclineDialog loan={loan} open={declining} onOpenChange={setDeclining} />
      </div>
    );
  }
  if (loan.status === "DISBURSED") {
    return (
      <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => move.mutate({ loanId: loan.id, to: "ACTIVE" })}>
        {spin(move.isPending) || <PlayCircle size={14} />} {tr({ en: "Start repayment", pt: "Iniciar pagamentos" })}
      </Button>
    );
  }
  if (loan.status === "ACTIVE") {
    return (
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button size="sm" disabled={busy} className="gap-1.5"
            onClick={() => pay.mutate({ loanId: loan.id, n: next.instalment_no, cents: loan.instalment_cents })}>
            {spin(pay.isPending) || <Receipt size={14} />} {tr({ en: `Record instalment ${next.instalment_no}`, pt: `Registrar parcela ${next.instalment_no}` })}
          </Button>
        )}
        {!next && (
          <Button size="sm" disabled={busy} onClick={() => move.mutate({ loanId: loan.id, to: "PAID", note: "All instalments received" })}>
            {spin(move.isPending)} {tr({ en: "Mark paid off", pt: "Marcar como quitado" })}
          </Button>
        )}
        {loan.overdue > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={busy}>{tr({ en: "Mark defaulted", pt: "Marcar como inadimplente" })}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {tr({ en: `Mark ${loan.participant}'s loan defaulted?`, pt: `Marcar o empréstimo de ${loan.participant} como inadimplente?` })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {tr({
                    en: `${loan.overdue} instalment${loan.overdue === 1 ? " is" : "s are"} overdue. A default is final: it is proven on Solana, her investors see it on their positions, and no further instalments can be recorded.`,
                    pt: `${loan.overdue} ${loan.overdue === 1 ? "parcela está" : "parcelas estão"} em atraso. A inadimplência é definitiva: ela é registrada na Solana, os investidores dela a veem nas posições deles, e nenhuma outra parcela pode ser registrada.`,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tr({ en: "Keep following up", pt: "Continuar acompanhando" })}</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => move.mutate({ loanId: loan.id, to: "DEFAULTED", note: `${loan.overdue} instalment${loan.overdue === 1 ? "" : "s"} overdue` })}>
                  {tr({ en: "Mark defaulted", pt: "Marcar como inadimplente" })}
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
