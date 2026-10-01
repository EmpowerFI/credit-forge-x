import type { Tone } from "../components/product/StatusPill";
import type { Database } from "./platform.types";
import { platform } from "./platform";
import { formatNumber, getLocale, localized, tr } from "../i18n";

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
  /**
   * The batch whose single transfer carried this payment into the vault.
   * `members` is the anonymity set: one member hides nothing, and the screen
   * says so rather than implying otherwise.
   */
  batch: {
    status: "open" | "sending" | "credited" | "failed";
    members: number;
    credited_micro_usdc: number;
    unit_micro_usdc: number;
    signature: string | null;
  } | null;
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

export const STATUS_LABEL: Record<ZcashStatus, { label: string; tone: Tone }> = localized({
  awaiting: { label: { en: "Awaiting payment", pt: "Aguardando pagamento" }, tone: "info" },
  seen: { label: { en: "Seen on Zcash", pt: "Visto na Zcash" }, tone: "caution" },
  confirmed: { label: { en: "Confirmed · crediting", pt: "Confirmado · creditando" }, tone: "caution" },
  credited: { label: { en: "Allocated", pt: "Alocado" }, tone: "positive" },
  underpaid: { label: { en: "Paid less than asked", pt: "Pago abaixo do pedido" }, tone: "alert" },
  expired: { label: { en: "Expired unpaid", pt: "Expirado sem pagamento" }, tone: "neutral" },
  failed: { label: { en: "Not allocated", pt: "Não alocado" }, tone: "alert" },
});

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

/**
 * What an explorer can and cannot say about a shielded payment, wherever one
 * is linked. The link is the first thing a reader clicks and it often answers
 * "Transaction Not Found": testnet explorers lag, and not every one indexes
 * the newest shielded pool. Without this sentence beside it, that reads as
 * the payment having failed, when the payment is exactly what the explorer
 * was never able to show.
 */
export const shieldedExplorerNote = () => tr({
  en: "A shielded transaction shows no amount, no memo and no addresses on an explorer — that is the point of it. An explorer can only say that a transaction exists, and testnet explorers often lag or do not index the newest shielded pool, so this link may find nothing. What proves the payment is the treasury's viewing key, which the audit console hands over with the commands to read the same notes without trusting EmpowerFI.",
  pt: "Uma transação blindada não mostra valor, memo nem endereços em um explorador — é exatamente esse o ponto dela. Um explorador só consegue dizer que uma transação existe, e exploradores de testnet costumam atrasar ou não indexar o pool blindado mais novo, então este link pode não achar nada. Quem prova o pagamento é a chave de visualização do tesouro, que o console de auditoria entrega com os comandos para ler as mesmas notas sem confiar na EmpowerFI.",
});

/** The same caution, short enough to sit on the link itself. */
export const explorerCaveat = () => tr({
  en: "An explorer can only say a transaction exists — never the amount, the memo or the addresses. Testnet explorers often lag, so it may find nothing.",
  pt: "Um explorador só consegue dizer que a transação existe — nunca o valor, o memo ou os endereços. Exploradores de testnet costumam atrasar, então pode não achar nada.",
});

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

export const RETURN_LABEL: Record<ReturnStatus, { label: string; tone: Tone }> = localized({
  due: { label: { en: "Owed in ZEC", pt: "A pagar em ZEC" }, tone: "info" },
  sending: { label: { en: "Being sent", pt: "Sendo enviado" }, tone: "info" },
  sent: { label: { en: "Sent in ZEC", pt: "Enviado em ZEC" }, tone: "positive" },
  failed: { label: { en: "Needs a look", pt: "Precisa de atenção" }, tone: "alert" },
});

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
