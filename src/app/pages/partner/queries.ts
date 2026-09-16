import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LoanStatus } from "../../lib/credit";
import { describeError } from "../../lib/errors";
import type { PartnerDesk } from "../../lib/partner";
import { platform } from "../../lib/platform";

// The P2P desk's reads and actions. The desk is one read; every action goes
// through the same functions the seed and the tests use, and refreshes it.

export function usePartnerDesk() {
  return useQuery({
    queryKey: ["platform", "partner-desk"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("partner_desk");
      if (error) throw error;
      return data as unknown as PartnerDesk;
    },
    // Proofs land on devnet a few seconds after each action.
    refetchInterval: 15_000,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["platform"] });
}

/** A decline, before a loan exists: what investors put in goes back to them. */
export function useDecline() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ opportunityId, reason }: { opportunityId: string; reason: string }) => {
      const { error } = await platform.rpc("partner_decide", { p_opportunity_id: opportunityId, p_verdict: "declined", p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Declined. Any investor capital in it is on its way back.");
      refresh();
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

/**
 * Formalising a funded opportunity at the allocation engine's rate, and
 * disbursing it: two proven steps, one click.
 */
export function useFormaliseAndDisburse() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ opportunityId }: { opportunityId: string }) => {
      const { data: loanId, error } = await platform.rpc("formalise_loan", { p_opportunity_id: opportunityId });
      if (error) throw error;
      const { error: moveError } = await platform.rpc("transition_loan", { p_loan_id: loanId as string, p_to: "DISBURSED", p_note: "Contract signed; Pix sent" });
      if (moveError) throw moveError;
    },
    onSuccess: () => {
      toast.success("Formalised at the engine's rate and disbursed. Her Pix is recorded, and the loan is being proven on Solana.");
      refresh();
    },
    onError: (e) => {
      toast.error(describeError(e));
      refresh();
    },
  });
}

const MOVED: Partial<Record<LoanStatus, string>> = {
  DISBURSED: "Disbursed. Her Pix is recorded; for a global loan, investor USDC leaves the vault for the off-ramp.",
  ACTIVE: "Repayment started. The first instalment is due in a month.",
  PAID: "Paid off.",
  DEFAULTED: "Marked defaulted.",
  CANCELLED: "Declined at formalisation. Investors are being refunded.",
};

export function useTransition() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ loanId, to, note }: { loanId: string; to: LoanStatus; note?: string }) => {
      const { error } = await platform.rpc("transition_loan", { p_loan_id: loanId, p_to: to, p_note: note || undefined });
      if (error) throw error;
      return to;
    },
    onSuccess: (to) => {
      toast.success(MOVED[to] ?? "Updated.");
      refresh();
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

export function useRecordPayment() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ loanId, n, cents }: { loanId: string; n: number; cents: number }) => {
      const { error } = await platform.rpc("record_payment", { p_loan_id: loanId, p_instalment_no: n, p_amount_cents: cents });
      if (error) throw error;
      return n;
    },
    onSuccess: (n) => {
      toast.success(`Instalment ${n} recorded. Investors' shares go back to them.`);
      refresh();
    },
    onError: (e) => toast.error(describeError(e)),
  });
}
