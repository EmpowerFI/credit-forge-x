// MoneyGram Ramps: pricing a USDC cash-out in Brazil on its sandbox.
//
// A quote is what MoneyGram would charge to turn USDC on Solana into reais:
// its fee, its rate and what is received. Nothing is sent and no customer is
// named — a quote carries an amount and a destination country, nothing else.
// In Brazil the sandbox prices cash pickup only (WILL_CALL), from $2 to $500 a
// transfer — re-measured 22 Sep 2026, when the ceiling turned out to be $500.

export const MONEYGRAM_MIN_MICRO_USDC = 2_000_000;
export const MONEYGRAM_MAX_MICRO_USDC = 500_000_000;

/** The body of POST /v1/quotes for a USDC cash-out to reais, amount at cent precision. */
export function quoteRequest(microUsdc: number) {
  if (!Number.isSafeInteger(microUsdc) || microUsdc <= 0) throw new Error("amount must be a positive integer of micro-USDC");
  return {
    destinationCountry: "BRA",
    receiveCurrencyCode: "BRL",
    sendAmount: Math.floor(microUsdc / 10_000) / 100,
    amountAnchor: "send",
    asset: "USDC",
    chain: "solana",
    transactionType: "cash-out",
  };
}

/** "12.34" in hundredths, without going through a float. */
export function hundredths(value: unknown): number {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value)) throw new Error(`not a two-place amount: ${String(value)}`);
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

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
}

interface Money {
  value: string;
  currency: string;
}

/** MoneyGram's quote response, in the units the platform keeps: micro-USDC and centavos. */
export function readQuote(body: unknown): RampQuote {
  const r = body as {
    serviceOptions?: { serviceOptionCode?: string; displayName?: string }[];
    serviceOptionCode?: string;
    quote?: {
      sendAmount: Money;
      sendPrincipal: Money;
      receiveAmount: Money;
      fees: { total: Money };
      exchangeRate: number;
      fxRateEstimated?: boolean;
      expiresAt: string;
    };
  };
  const q = r?.quote;
  if (!q) throw new Error("no quote in MoneyGram's response");
  const usdc = (m: Money) => {
    if (m?.currency !== "USDC") throw new Error(`expected USDC, got ${m?.currency}`);
    return hundredths(m.value) * 10_000;
  };
  if (q.receiveAmount?.currency !== "BRL") throw new Error(`expected BRL, got ${q.receiveAmount?.currency}`);
  if (typeof q.exchangeRate !== "number" || !(q.exchangeRate > 0)) throw new Error("no exchange rate");
  const option = r.serviceOptions?.find((o) => o.serviceOptionCode === r.serviceOptionCode) ?? r.serviceOptions?.[0];
  return {
    source: "moneygram_sandbox",
    service: option?.displayName ?? r.serviceOptionCode ?? "Cash pickup",
    send_micro_usdc: usdc(q.sendAmount),
    fee_micro_usdc: usdc(q.fees.total),
    converted_micro_usdc: usdc(q.sendPrincipal),
    receive_cents: hundredths(q.receiveAmount.value),
    brl_per_usdc: q.exchangeRate,
    rate_estimated: q.fxRateEstimated ?? true,
    expires_at: q.expiresAt,
  };
}
