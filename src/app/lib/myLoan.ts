import { formatNumber } from "../i18n";
import { platform } from "./platform";

// Her loan, as public.my_loan() shapes it: one read, with the parity and the
// struck rate already applied.

export interface LoanPayment {
  no: number;
  amount_cents: number;
  paid_at: string;
  /** Whether that instalment travelled the local rail. Not every one did. */
  on_the_rail: boolean;
}

export interface MyLoanLocal {
  economy: string;
  currency: string;
  balance_units: number;
  instalment_units: number;
}

export interface MyLoan {
  loan_id: string;
  status: string;
  purpose: string;
  principal_cents: number;
  term_months: number;
  instalment_cents: number;
  paid: number;
  /** Null once every instalment is paid. */
  next_no: number | null;
  left_cents: number;
  disbursed_at: string | null;
  fx_brl_per_usdc_milli: number | null;
  instalment_micro_usdc: number | null;
  /** Null where this loan was not disbursed on a local rail. */
  local: MyLoanLocal | null;
  payments: LoanPayment[];
}

/** What one instalment did on its way out, as pay_instalment() reports it. */
export interface Paid {
  payment_id: string;
  instalment_no: number;
  of_term: number;
  amount_cents: number;
  paid_count: number;
  local_units: number | null;
  local_economy: string | null;
  micro_usdc: number | null;
  fx_brl_per_usdc_milli: number | null;
}

export const myLoanKey = ["platform", "my-loan"] as const;

export async function fetchMyLoan(): Promise<MyLoan | null> {
  const { data, error } = await platform.rpc("my_loan");
  if (error) throw error;
  return (data ?? null) as unknown as MyLoan | null;
}

export async function payInstalment(loanId: string): Promise<Paid> {
  const { data, error } = await platform.rpc("pay_instalment", { p_loan_id: loanId });
  if (error) throw error;
  return data as unknown as Paid;
}

// Both through the app's own formatter, not toLocaleString with an undefined
// locale: that follows the browser, so a Portuguese screen printed "1,286.56"
// beside "R$ 351,03" — two decimal marks in one sentence, on the one screen
// whose whole job is to make a sum of money legible to the person paying it.

/** Local units are held to the cent, like the reais behind them. */
export const units = (u: number, currency: string) =>
  `${formatNumber(u / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export const usdc = (micro: number) =>
  `${formatNumber(micro / 1e6, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
