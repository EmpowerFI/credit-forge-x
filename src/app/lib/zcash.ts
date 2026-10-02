import type { Tone } from "../components/product/StatusPill";
import type { Database } from "./platform.types";
import { platform } from "./platform";
import { formatNumber, getLocale, localized, tr } from "../i18n";
import { usdc } from "./solana";

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
   * The batch whose single transfer carried this payment into the vault. Two
   * counts, because they answer different questions: `members` is how many
   * positions shared the movement, which is what blends the individual amounts,
   * and `investors` is how many people, which is what blends the totals. The
   * screen claims on the stricter one.
   */
  batch: {
    status: "open" | "sending" | "credited" | "failed";
    members: number;
    investors: number;
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
 * Why this table stands in for a block explorer, said before the reader looks
 * for one. On mainnet an explorer would confirm a transaction exists; on
 * testnet none of ours can, and a link that always answers "Transaction Not
 * Found" reads as a failed or invented payment.
 *
 * Measured 2 Oct 2026 against testnet.zcashexplorer.app, because the earlier
 * guess here ("explorers lag") was wrong and would not survive a reader who
 * checks: its indexer was *ahead* of our transactions at height 4,441,713, and
 * a transaction id taken from its own block listing resolved normally — while
 * all 20 ids from both EmpowerFI wallets returned not-found. Every note in the
 * treasury is in the Ironwood pool, added in NU6.3, which testnet explorers do
 * not index. So the explorer is current and correct, and simply has nothing to
 * show: a shielded transaction carries no address, value or memo in the clear.
 *
 * The replacement is this table plus the viewing key beneath it, which is a
 * stronger artefact than the link ever was — it carries the value, the pool and
 * the memo, and it can be reproduced by anyone holding the key.
 */
export const shieldedExplorerNote = () => tr({
  en: "This table is what a block explorer would be, and no explorer can replace it. A shielded transaction carries no address, no value and no memo in the clear, so there is nothing for one to display; the notes below sit in Zcash's Ironwood pool, added in NU6.3, which testnet explorers do not index at all. Every figure here was read with the treasury's viewing key, which is published under this table: it reads every note and can spend nothing, so anyone can reproduce this list in their own wallet without trusting EmpowerFI.",
  pt: "Esta tabela é o que um explorador de blocos seria, e nenhum explorador pode substituí-la. Uma transação blindada não carrega endereço, valor nem memo em claro, então não há o que um exibir; as notas abaixo estão no pool Ironwood da Zcash, criado na NU6.3, que exploradores de testnet não indexam. Cada número aqui foi lido com a chave de visualização do tesouro, publicada abaixo desta tabela: ela lê todas as notas e não gasta nada, de modo que qualquer pessoa reproduz esta lista na própria carteira sem confiar na EmpowerFI.",
});

/** Why a testnet row carries no explorer link, short enough to sit in the cell. */
export const explorerCaveat = () => tr({
  en: "No explorer link on testnet: a shielded transaction has no address, value or memo to show, and the Ironwood pool these notes use is not indexed by testnet explorers. The row above is the record; the viewing key below reproduces it.",
  pt: "Sem link de explorador na testnet: uma transação blindada não tem endereço, valor ou memo a mostrar, e o pool Ironwood destas notas não é indexado por exploradores de testnet. A linha acima é o registro; a chave de visualização abaixo o reproduz.",
});

/** The in-cell label where a mainnet build would show an explorer link. */
export const explorerUnavailable = () => tr({
  en: "not on any explorer",
  pt: "fora dos exploradores",
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

/** The batch a payment was carried in, as `zcash_request` reports it. */
export type BatchOf = NonNullable<ZcashRequest["batch"]>;

/**
 * What a batch did for this investor, in one sentence, claiming only what its
 * counts support. Four cases, and the honesty is in the middle two:
 *
 *   nothing credited  the batch has not crossed a whole unit, so no movement
 *                     exists to hide anything in — but her ZEC arrived, and the
 *                     book says so while the vault waits.
 *   several investors the strong claim: the movement's total is nobody's.
 *   one investor, several positions
 *                     the amounts blend, the total does not. Saying only the
 *                     first half here would be the lie worth avoiding.
 *   one position      it hides nothing, and a reader who knows privacy checks
 *                     this first, so the screen says it before they ask.
 */
export function batchLine(batch: BatchOf): string {
  if (batch.credited_micro_usdc === 0) {
    return tr({
      en: `Together the batch is still under one unit of ${usdc(batch.unit_micro_usdc)}, so nothing has moved on Solana yet. Your position is booked — your ZEC arrived — and the vault catches up with the next batch.`,
      pt: `Somado, o lote ainda está abaixo de uma unidade de ${usdc(batch.unit_micro_usdc)}, então nada se moveu na Solana ainda. Sua posição está registrada — seu ZEC chegou — e o cofre acerta no próximo lote.`,
    });
  }
  const moved = usdc(batch.credited_micro_usdc);
  const others = batch.investors - 1;
  if (others >= 1) {
    return tr({
      en: `Your capital entered with ${others} other investor${others === 1 ? "" : "s"}, in one movement of ${moved}. That number is nobody's amount, so Solana shows neither your position nor your total.`,
      pt: `Seu capital entrou junto com ${others} outra${others === 1 ? "" : "s"} investidora${others === 1 ? "" : "s"}, num movimento único de ${moved}. Esse número não é o valor de ninguém, então a Solana não mostra nem sua posição nem seu total.`,
    });
  }
  if (batch.members > 1) {
    return tr({
      en: `One movement of ${moved} carried ${batch.members} of your positions, so none of their sizes is readable — but you were the only investor in it, so the movement itself is yours. It takes someone else paying in the same window to hide the total.`,
      pt: `Um movimento único de ${moved} levou ${batch.members} posições suas, então nenhum dos tamanhos é legível — mas você foi a única investidora nele, então o movimento inteiro é seu. Esconder o total depende de outra pessoa pagar na mesma janela.`,
    });
  }
  return tr({
    en: `One movement of ${moved} carried this position alone, so it hides nothing: a batch of one is not a crowd. Amounts stop being readable once others pay in the same window.`,
    pt: `Um movimento de ${moved} levou só esta posição, então ele não esconde nada: um lote de um não é multidão. Os valores deixam de ser legíveis quando outras pessoas pagam na mesma janela.`,
  });
}
