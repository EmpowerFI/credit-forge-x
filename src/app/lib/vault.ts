// The vault against the book, and why the two directions are not the same thing.
//
// Three screens compared them for equality and reported a failure on any
// difference. On 2 Oct 2026 the shared report read "The vault holds 215.00
// USDC; the ledger says 145.00" with a red cross — and nothing was wrong. The
// devnet vault has held test funds since September that no investment claims,
// and money arriving that nobody has booked is not a defect.
//
// Only one direction is. A vault holding *less* than the book owes is a vault
// that might not pay everyone; a vault holding more is money nobody has asked
// for. Marking both as failures teaches the reader that the check is noise,
// which costs more than the check is worth.
//
// A shortfall is still not proof of a defect, and this is where the Zcash batch
// comes in: credits cross into the vault in whole units and the remainder waits
// in the queue, so between batches the book legitimately runs ahead by less than
// one unit. The screens cannot see the outstanding carry — it is not in the
// report's snapshot — so a shortfall is reported as something to look at rather
// than something that is wrong, and the text names the queue as the first thing
// to check. A numeric version of that test needs the carry in the snapshot.

import { tr } from "../i18n";

export type VaultStanding =
  /** The chain has not been read, or the vault has no token account yet. */
  | "unknown"
  /** The vault holds exactly what the book accounts for. */
  | "exact"
  /** More than the book claims: unclaimed money, not a shortfall. */
  | "surplus"
  /** Less than the book owes: the one direction worth a look. */
  | "short";

export function vaultStanding(chain: number | bigint | null | undefined, book: number): VaultStanding {
  if (chain === null || chain === undefined) return "unknown";
  const held = BigInt(chain);
  const owed = BigInt(Math.round(book));
  if (held === owed) return "exact";
  return held > owed ? "surplus" : "short";
}

/**
 * Whether a standing reads as a pass. `null` is "not known", which the screens
 * draw as a caution rather than a cross — including for a shortfall, which is a
 * thing to look at and not yet a thing that is wrong.
 */
export const vaultOk = (standing: VaultStanding): boolean | null =>
  standing === "unknown" || standing === "short" ? null : true;

/** What to say under the figures, given how the two sides differ. */
export function vaultNote(standing: VaultStanding, difference: (n: number) => string, gap: number): string | null {
  if (standing === "surplus") {
    return tr({
      en: `${difference(gap)} more than the book claims. Everything the book owes is covered; the surplus is money no investment claims — on devnet, funds that reached the vault outside a recorded deposit.`,
      pt: `${difference(gap)} a mais do que o livro reivindica. Tudo o que o livro deve está coberto; a sobra é dinheiro que nenhum investimento reivindica — na devnet, valores que chegaram ao cofre fora de um depósito registrado.`,
    });
  }
  if (standing === "short") {
    return tr({
      en: `${difference(gap)} less than the book owes. Up to one batch unit of this is the Zcash queue, where a remainder waits for the next batch; beyond that, a credit is in flight or something the book counts never arrived.`,
      pt: `${difference(gap)} a menos do que o livro deve. Até uma unidade de lote disso é a fila da Zcash, onde um troco aguarda o próximo lote; além disso, um crédito está a caminho ou algo que o livro conta nunca chegou.`,
    });
  }
  return null;
}
