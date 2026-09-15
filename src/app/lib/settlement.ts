import type { Tone } from "../components/product/StatusPill";

// Settlement: how capital reaches her business and comes back, and which of
// its legs are real on devnet, simulated at a quote, or mocks.

export type Reality = "real" | "zcash" | "simulated" | "mock" | "indicative";

export const REALITY: Record<Reality, { label: string; tone: Tone }> = {
  real: { label: "Real · Solana devnet", tone: "positive" },
  zcash: { label: "Real · Zcash testnet", tone: "positive" },
  simulated: { label: "Simulated", tone: "caution" },
  mock: { label: "Mock", tone: "neutral" },
  indicative: { label: "Indicative", tone: "info" },
};

/** What is real in this demo, leg by leg. */
export const WHAT_IS_REAL: { what: string; reality: Reality; note: string }[] = [
  { what: "Devnet SOL and USDC", reality: "real", note: "Circle's devnet USDC. Test tokens with no value." },
  { what: "Wallet signing and deposits into the vault", reality: "real", note: "A token transfer to the program's vault, read back from chain before it is allocated." },
  { what: "Paying with shielded ZEC", reality: "zcash", note: "A real payment, read with the treasury's viewing key." },
  { what: "ZEC → USDC", reality: "simulated", note: "NEAR Intents in production, which has no testnet. The operator credits the vault at the quote." },
  { what: "Releases to the ramp, payouts to investors", reality: "real", note: "The program's vault_transfer, signed by the operator. On devnet the operator plays the ramp partner." },
  { what: "USDC → reais at the ramp", reality: "simulated", note: "At the demo quote less the ramp's spread. A sandbox quote once ramp credentials are provided." },
  { what: "Pix to her business, and her instalments", reality: "mock", note: "End-to-end ids in Pix's format. No Pix is sent." },
  { what: "Proofs of every record", reality: "real", note: "Commitments on Solana devnet, recomputed in your browser by Verify." },
  { what: "Participants, loans and most positions", reality: "simulated", note: "Seeded demo data, marked as such." },
  { what: "Yields and returns", reality: "indicative", note: "At the reference rate and the demo quote. Not a promise." },
];

/** A Pix end-to-end id's shape: 'E', an 8-digit institution code (99999999, no real one), the minute in UTC, 11 characters. */
export function mockPixE2e(at = new Date()): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(11));
  const pad = (n: number) => String(n).padStart(2, "0");
  const minute = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}`;
  return `E99999999${minute}${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Reais, in centavos, that a USDC amount becomes at a quote (milli-reais per USDC) less spreads in basis points. */
export function reaisAtRamp(microUsdc: number, fxMilli: number, spreadBps: number): number {
  return Math.floor(((microUsdc / 1e6) * (fxMilli / 1000) * 100 * (10_000 - spreadBps)) / 10_000);
}

export interface SettlementOverview {
  fx_brl_per_usdc_milli: number;
  ramp_bps: number;
  vault: { in_vault_micro_usdc: number; deposits_micro_usdc: number; released_micro_usdc: number; repaid_in_micro_usdc: number; paid_out_micro_usdc: number };
  pix: { payouts: number; payout_cents: number; ins: number; in_cents: number };
  legs: Record<string, number> | null;
  transfers: { id: number; kind: "release" | "payout"; status: "pending" | "confirmed" | "failed"; signature: string | null;
    inflow_micro_usdc: number; outflow_micro_usdc: number; legs: number; at: string }[];
  mine: { paid_out_micro_usdc: number; due_micro_usdc: number; held_micro_usdc: number; payouts: number };
}

export type PayoutStatus = "due" | "held" | "sending" | "done" | "failed";
