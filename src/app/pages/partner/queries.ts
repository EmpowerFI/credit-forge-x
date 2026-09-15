import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LoanStatus } from "../../lib/credit";
import { describeError } from "../../lib/errors";
import type { PartnerDesk } from "../../lib/partner";
import { platform } from "../../lib/platform";

// The partner's reads and actions. The desk is one read; every action goes
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

export interface Decision {
  opportunityId: string;
  verdict: "approved" | "declined";
  amountCents?: number;
  rateBps?: number;
  termMonths?: number;
  reason?: string;
}

export function useDecide() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (d: Decision) => {
      const { error } = await platform.rpc("partner_decide", {
        p_opportunity_id: d.opportunityId,
        p_verdict: d.verdict,
        ...(d.verdict === "approved"
          ? { p_approved_amount_cents: d.amountCents, p_rate_bps: d.rateBps, p_term_months: d.termMonths }
          : {}),
        p_reason: d.reason || undefined,
      });
      if (error) throw error;
      return d.verdict;
    },
    onSuccess: (verdict) => {
      toast.success(verdict === "approved"
        ? "Approved. The loan terms are being proven on Solana."
        : "Declined. Any investor capital in it is on its way back.");
      refresh();
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

const MOVED: Partial<Record<LoanStatus, string>> = {
  DISBURSED: "Disbursed. Her Pix is recorded, and investor capital leaves the vault for the ramp.",
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
      toast.success(`Instalment ${n} recorded. Investors' shares go back through the ramp.`);
      refresh();
    },
    onError: (e) => toast.error(describeError(e)),
  });
}
