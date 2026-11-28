import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { base58Bytes, base64Bytes, challengeMessage, isAddress, newNonce, signedBy } from "./seeker-wallet.ts";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

async function wallet() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const address = base58(raw);
  const sign = async (m: string) => new Uint8Array(await crypto.subtle.sign("Ed25519", pair.privateKey, new TextEncoder().encode(m)));
  return { address, sign };
}

const NOW = new Date("2026-11-27T15:00:00Z");

Deno.test("base58 reads a Solana address as its 32 bytes", () => {
  assertEquals(base58Bytes("11111111111111111111111111111111"), new Uint8Array(32));
  assert(isAddress("Ax71Ar1DU2N685CEqmhHwWCtEoibtRVZztcjRqQN3UNb"));
  assertFalse(isAddress("0OIl-not-an-address"));
  assertFalse(isAddress("abc"));
  assertFalse(isAddress(42));
});

Deno.test("the message names the site, her wallet, the nonce and five minutes", () => {
  const m = challengeMessage({ origin: "https://empowerfi-seeker-dev.vercel.app", address: "Ax71Ar1DU2N685CEqmhHwWCtEoibtRVZztcjRqQN3UNb", nonce: "abc123", now: NOW });
  const lines = m.split("\n");
  assertEquals(lines[0], "empowerfi-seeker-dev.vercel.app wants you to sign in with your Solana account:");
  assertEquals(lines[1], "Ax71Ar1DU2N685CEqmhHwWCtEoibtRVZztcjRqQN3UNb");
  assert(lines.includes("URI: https://empowerfi-seeker-dev.vercel.app/app/seeker"));
  assert(lines.includes("Chain ID: devnet"));
  assert(lines.includes("Nonce: abc123"));
  assert(lines.includes("Issued At: 2026-11-27T15:00:00.000Z"));
  assert(lines.includes("Expiration Time: 2026-11-27T15:05:00.000Z"));
  assert(/no transaction, no fee/.test(m));
});

Deno.test("a nonce is 32 hex characters and new each time", () => {
  const a = newNonce();
  assert(/^[0-9a-f]{32}$/.test(a));
  assert(a !== newNonce());
});

Deno.test("her signature of the message proves the wallet", async () => {
  const w = await wallet();
  const m = challengeMessage({ origin: "https://x.app", address: w.address, nonce: newNonce(), now: NOW });
  assert(await signedBy(w.address, m, await w.sign(m)));
});

Deno.test("another wallet's signature, or another message, proves nothing", async () => {
  const her = await wallet();
  const other = await wallet();
  const m = challengeMessage({ origin: "https://x.app", address: her.address, nonce: "n1", now: NOW });
  assertFalse(await signedBy(her.address, m, await other.sign(m)));
  const old = challengeMessage({ origin: "https://x.app", address: her.address, nonce: "n0", now: NOW });
  assertFalse(await signedBy(her.address, m, await her.sign(old)));
  assertFalse(await signedBy(her.address, m, new Uint8Array(10)));
  assertFalse(await signedBy("not-an-address", m, await her.sign(m)));
});

Deno.test("a signature comes as base64", () => {
  assertEquals(base64Bytes(btoa("\u0001\u0002")), Uint8Array.from([1, 2]));
  assertEquals(base64Bytes("***"), null);
  assertEquals(base64Bytes(7), null);
});
