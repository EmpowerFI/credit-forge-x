import type { Tone } from "../components/product/StatusPill";
import type { Database } from "./platform.types";
import { platform } from "./platform";
import { formatNumber, getLocale } from "../i18n";

// Investing with shielded ZEC (R5): the request an investor pays from any
// Zcash wallet, and how its progress reads, from the payment on Zcash to the
// allocation proven on Solana.

export type ZcashStatus = Database["public"]["Enums"]["zcash_request_status"];

export interface ZcashRequest {
  id: string;
  ref: string;
  status: ZcashStatus;
  address: string;
  network: "test" | "main";
  opportunity_id: string;
  opportunity_code: string;
  amount_zat: number;
  amount_micro_usdc: number;
  usd_per_zec_cents: number;
  quote_source: "coingecko" | "demo";
  memo: string;
  txid: string | null;
  pool: "sapling" | "orchard" | "ironwood" | null;
  received_zat: number | null;
  mined_height: number | null;
  confirmations: number | null;
  confirmations_needed: number;
  scanned_height: number | null;
  scanned_at: string | null;
  credit_signature: string | null;
  investment_id: string | null;
  proof: { status: string; signature: string | null } | null;
  error: string | null;
  expires_at: string;
  created_at: string;
  /** Only in the reply that created it. */
  uri?: string;
}

/** Live: the request still holds its share, or its payment is on its way. */
export const LIVE: ZcashStatus[] = ["awaiting", "seen", "confirmed"];

export const STATUS_LABEL: Record<ZcashStatus, { label: string; tone: Tone }> = {
  awaiting: { label: "Awaiting payment", tone: "info" },
  seen: { label: "Seen on Zcash", tone: "caution" },
  confirmed: { label: "Confirmed · crediting", tone: "caution" },
  credited: { label: "Allocated", tone: "positive" },
  underpaid: { label: "Paid less than asked", tone: "alert" },
  expired: { label: "Expired unpaid", tone: "neutral" },
  failed: { label: "Not allocated", tone: "alert" },
};

export const POOL_LABEL: Record<string, string> = { sapling: "Sapling", orchard: "Orchard", ironwood: "Ironwood" };

/** Testnet ZEC ("TAZ") or ZEC, to eight places without trailing zeros. */
export function zec(zat: number | null | undefined, network: "test" | "main" = "test"): string {
  if (zat === null || zat === undefined) return "—";
  const whole = Math.floor(zat / 1e8);
  const frac = String(zat % 1e8).padStart(8, "0").replace(/0+$/, "");
  return `${frac ? `${whole}.${frac}` : whole} ${network === "test" ? "TAZ" : "ZEC"}`;
}

/** ZIP 321, as the zcash-request function builds it: amount in ZEC, memo in base64url without padding. */
export function paymentUri(r: Pick<ZcashRequest, "address" | "amount_zat" | "memo" | "ref">): string {
  const whole = Math.floor(r.amount_zat / 1e8);
  const frac = String(r.amount_zat % 1e8).padStart(8, "0").replace(/0+$/, "");
  let bin = "";
  for (const b of new TextEncoder().encode(r.memo)) bin += String.fromCharCode(b);
  const memo = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `zcash:${r.address}?amount=${frac ? `${whole}.${frac}` : whole}&memo=${memo}&message=${encodeURIComponent(`EmpowerFI ${r.ref}`)}`;
}

export const usdPerZec = (cents: number) =>
  `${getLocale() === "pt" ? "US$ " : "$"}${formatNumber(cents / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A shielded transaction on a Zcash explorer: that it exists and when — never amounts, memos or addresses. */
export const zcashExplorerTx = (txid: string, network: "test" | "main" = "test") =>
  network === "test" ? `https://testnet.zcashexplorer.app/transactions/${txid}` : `https://mainnet.zcashexplorer.app/transactions/${txid}`;

export const ZCASH_FAUCET = "https://zcashfaucet.jinolabs.xyz/";

export async function createZcashRequest(opportunityId: string, microUsdc: number): Promise<ZcashRequest> {
  const { data, error } = await platform.functions.invoke("zcash-request", {
    body: { opportunity_id: opportunityId, amount_micro_usdc: microUsdc },
  });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  return data as ZcashRequest;
}

export async function fetchZcashRequest(id: string): Promise<ZcashRequest> {
  const { data, error } = await platform.rpc("zcash_request", { p_id: id });
  if (error) throw error;
  return data as unknown as ZcashRequest;
}

/** Asks the watcher to read the chain now, instead of at its next minute. */
export async function checkZcashNow(): Promise<void> {
  const { error } = await platform.functions.invoke("zcash-watch", { body: {} });
  if (error) throw error;
}

// ------------------------------------------------------------ returns in ZEC

/** A shielded testnet address — unified or Sapling — in the database's own check. */
export const isShieldedTestAddress = (value: string) =>
  /^(utest1[02-9ac-hj-np-z]{60,}|ztestsapling1[02-9ac-hj-np-z]{60,})$/.test(value.trim().toLowerCase());

export type ReturnStatus = "due" | "sending" | "sent" | "failed";

export interface ZecReturn {
  id: string;
  kind: "payout" | "refund";
  leg_id: string | null;
  amount_micro_usdc: number;
  amount_zat: number | null;
  usd_per_zec_cents: number | null;
  status: ReturnStatus;
  txid: string | null;
  instalment_no: number | null;
  created_at: string;
  sent_at: string | null;
}

export interface ZecReturns { return_address: string | null; network: "test" | "main" | null; returns: ZecReturn[] }

export const RETURN_LABEL: Record<ReturnStatus, { label: string; tone: Tone }> = {
  due: { label: "Owed in ZEC", tone: "info" },
  sending: { label: "Being sent", tone: "info" },
  sent: { label: "Sent in ZEC", tone: "positive" },
  failed: { label: "Needs a look", tone: "alert" },
};

export const zecReturnsKey = (investmentId: string) => ["platform", "zec-returns", investmentId];

export async function fetchZecReturns(investmentId: string): Promise<ZecReturns> {
  const { data, error } = await platform.rpc("zcash_position_returns", { p_investment_id: investmentId });
  if (error) throw error;
  return data as unknown as ZecReturns;
}

export async function setReturnAddress(target: { investmentId: string } | { requestId: string }, address: string) {
  const { error } = "investmentId" in target
    ? await platform.rpc("set_zcash_return_address", { p_investment_id: target.investmentId, p_address: address })
    : await platform.rpc("set_zcash_request_return_address", { p_request_id: target.requestId, p_address: address });
  if (error) throw error;
}
