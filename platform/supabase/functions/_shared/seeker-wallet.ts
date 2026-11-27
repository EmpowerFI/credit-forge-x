// The Seeker app's wallet check (PLAN_SEEKER.md §3.2): the message she signs
// to prove the wallet on her phone is hers, and the check of her signature.
// A Sign In With Solana message, in the order wallets expect: no transaction,
// no fee, valid five minutes, with a nonce used once.

export const SEEKER_STATEMENT =
  "Receive your EmpowerFI rewards in this wallet. This signs a message only: no transaction, no fee.";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 (Bitcoin alphabet) to bytes. Here rather than @solana/kit, which wants env access in the shared tests. */
export function base58Bytes(value: string): Uint8Array<ArrayBuffer> {
  let n = 0n;
  for (const c of value) {
    const digit = ALPHABET.indexOf(c);
    if (digit < 0) throw new Error("not base58");
    n = n * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const c of value) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

export function isAddress(value: unknown): value is string {
  if (typeof value !== "string" || !ADDRESS.test(value)) return false;
  try {
    return base58Bytes(value).length === 32;
  } catch {
    return false;
  }
}

export function challengeMessage(input: { origin: string; address: string; nonce: string; now: Date }): string {
  const url = new URL(input.origin);
  const expires = new Date(input.now.getTime() + 5 * 60_000);
  return [
    `${url.host} wants you to sign in with your Solana account:`,
    input.address,
    "",
    SEEKER_STATEMENT,
    "",
    `URI: ${url.origin}/app/seeker`,
    "Version: 1",
    "Chain ID: devnet",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.now.toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
  ].join("\n");
}

/** A nonce of 16 random bytes, as letters and digits (SIWS wants alphanumerics). */
export function newNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function base64Bytes(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || value.length > 200) return null;
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Whether `signature` is the wallet `address`'s Ed25519 signature of exactly `message`. */
export async function signedBy(address: string, message: string, signature: Uint8Array): Promise<boolean> {
  if (!isAddress(address) || signature.length !== 64) return false;
  const key = await crypto.subtle.importKey(
    "raw", base58Bytes(address), { name: "Ed25519" }, false, ["verify"]);
  return await crypto.subtle.verify("Ed25519", key, new Uint8Array(signature), new TextEncoder().encode(message));
}
