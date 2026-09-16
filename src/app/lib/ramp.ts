import { platform } from "./platform";

// The ramp's side of the route, priced by MoneyGram Ramps' sandbox: a USDC
// cash-out in Brazil, quoted by the ramp-quote function. Only the amount and
// the country go to MoneyGram.

/** The sandbox quotes Brazil from $2 to $200 a transfer. */
export const RAMP_MIN_MICRO_USDC = 2_000_000;
export const RAMP_MAX_MICRO_USDC = 200_000_000;

export interface RampQuote {
  source: "moneygram_sandbox";
  service: string;
  send_micro_usdc: number;
  fee_micro_usdc: number;
  converted_micro_usdc: number;
  receive_cents: number;
  brl_per_usdc: number;
  rate_estimated: boolean;
  expires_at: string;
  quoted_at: string;
}

export const inRampRange = (microUsdc: number) => microUsdc >= RAMP_MIN_MICRO_USDC && microUsdc <= RAMP_MAX_MICRO_USDC;

/** MoneyGram's fee as a share of what was sent, in basis points. */
export const rampFeeBps = (q: Pick<RampQuote, "fee_micro_usdc" | "send_micro_usdc">) =>
  q.send_micro_usdc > 0 ? Math.round((q.fee_micro_usdc * 10_000) / q.send_micro_usdc) : 0;

/** What reaches her at a quote, after a tax on the inbound conversion (percent), in centavos. */
export function receivedAfterTax(receiveCents: number, taxPct: number) {
  const tax = Math.round((receiveCents * taxPct) / 100);
  return { tax_cents: tax, net_cents: Math.max(0, receiveCents - tax) };
}

export const rampQuoteKey = (microUsdc: number) => ["ramp-quote", microUsdc] as const;

export async function fetchRampQuote(microUsdc: number): Promise<RampQuote> {
  const { data, error } = await platform.functions.invoke("ramp-quote", { body: { amount_micro_usdc: microUsdc } });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  return data as RampQuote;
}
