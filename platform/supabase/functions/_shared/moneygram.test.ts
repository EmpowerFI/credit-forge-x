import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { hundredths, quoteRequest, readQuote } from "./moneygram.ts";

Deno.test("a quote request is a USDC cash-out on Solana to reais, at cent precision", () => {
  assertEquals(quoteRequest(100_000_000), {
    destinationCountry: "BRA",
    receiveCurrencyCode: "BRL",
    sendAmount: 100,
    amountAnchor: "send",
    asset: "USDC",
    chain: "solana",
    transactionType: "cash-out",
  });
  assertEquals(quoteRequest(12_345_678).sendAmount, 12.34);
  assertThrows(() => quoteRequest(0));
  assertThrows(() => quoteRequest(1.5));
});

Deno.test("amounts are read as hundredths without floats", () => {
  assertEquals(hundredths("484.46"), 48_446);
  assertEquals(hundredths("3.9"), 390);
  assertEquals(hundredths("10"), 1_000);
  assertThrows(() => hundredths("1.234"));
  assertThrows(() => hundredths(3.96));
  assertThrows(() => hundredths("-1"));
});

// The shape the sandbox returned for 100 USDC on 16 Sep 2026.
const SANDBOX = {
  clientTransactionResourceId: "9c587751-f900-4562-bfc3-cf5cbd0e452e",
  serviceOptions: [{
    mgiTransactionId: "9c587751-f900-4562-bfc3-cf5cbd0e452e",
    serviceOptionCode: "WILL_CALL",
    displayName: "Cash Pickup - Anywhere/10 Minute Service",
    transactionType: "cash-out",
  }],
  serviceOptionCode: "WILL_CALL",
  quote: {
    sendAmount: { value: "100.00", currency: "USDC" },
    sendPrincipal: { value: "96.04", currency: "USDC" },
    receiveAmount: { value: "484.46", currency: "BRL" },
    fees: { mgi: { value: "3.96", currency: "USDC" }, partner: { value: "0.00", currency: "USDC" }, total: { value: "3.96", currency: "USDC" } },
    exchangeRate: 5.0444,
    fxRateEstimated: true,
    destinationCountry: "BRA",
    expiresAt: "2026-09-16T15:10:36.848Z",
  },
};

Deno.test("a sandbox quote becomes micro-USDC and centavos", () => {
  assertEquals(readQuote(SANDBOX), {
    source: "moneygram_sandbox",
    service: "Cash Pickup - Anywhere/10 Minute Service",
    send_micro_usdc: 100_000_000,
    fee_micro_usdc: 3_960_000,
    converted_micro_usdc: 96_040_000,
    receive_cents: 48_446,
    brl_per_usdc: 5.0444,
    rate_estimated: true,
    expires_at: "2026-09-16T15:10:36.848Z",
  });
});

Deno.test("a quote in other currencies, or none, is refused", () => {
  assertThrows(() => readQuote({}));
  assertThrows(() => readQuote({ ...SANDBOX, quote: { ...SANDBOX.quote, receiveAmount: { value: "90.00", currency: "USD" } } }));
  assertThrows(() => readQuote({ ...SANDBOX, quote: { ...SANDBOX.quote, fees: { total: { value: "3.96", currency: "USD" } } } }));
  assertThrows(() => readQuote({ ...SANDBOX, quote: { ...SANDBOX.quote, exchangeRate: 0 } }));
});
