import {
  type Address,
  address,
  createSolanaRpc,
  getProgramDerivedAddress,
  type Signature,
} from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

// Devnet, where the whole platform runs: Circle's test USDC, the program's
// vault, and the reads the investor console needs. Devnet tokens have no value.

export const CLUSTER = "solana:devnet" as const;
export const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const USDC_DECIMALS = 6;
export const PROGRAM_ID = address("4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR");

export const FAUCETS = {
  sol: "https://faucet.solana.com",
  usdc: "https://faucet.circle.com",
};

export const rpc = createSolanaRpc(
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ?? "https://api.devnet.solana.com",
);

/** The program's vault: Circle USDC held by the program's `vault` address. */
export async function vaultAddress(): Promise<Address> {
  const [authority] = await getProgramDerivedAddress({ programAddress: PROGRAM_ID, seeds: ["vault"] });
  const [ata] = await findAssociatedTokenPda({ owner: authority, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

export async function usdcAccountOf(owner: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({ owner, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

/** SOL (lamports) and USDC (micro) held by a wallet; USDC 0 if it has no account yet. */
export async function balancesOf(owner: string): Promise<{ lamports: bigint; microUsdc: bigint }> {
  const wallet = address(owner);
  const [{ value: lamports }, usdc] = await Promise.all([
    rpc.getBalance(wallet, { commitment: "confirmed" }).send(),
    usdcAccountOf(wallet)
      .then((ata) => rpc.getTokenAccountBalance(ata, { commitment: "confirmed" }).send())
      .then(({ value }) => BigInt(value.amount))
      .catch(() => 0n),
  ]);
  return { lamports, microUsdc: usdc };
}

interface ParsedIx {
  program?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
}

/**
 * The USDC a transaction moved from `wallet` into the vault, read from chain —
 * the same check the server makes before recording an allocation, done again
 * in the viewer's browser. Null if the transaction is not found or failed.
 */
export async function depositToVault(signature: string, wallet: string): Promise<bigint | null> {
  const tx = await rpc
    .getTransaction(signature as Signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" })
    .send();
  if (!tx || tx.meta?.err) return null;
  const vault = await vaultAddress();
  const outer = (tx.transaction.message.instructions ?? []) as unknown as ParsedIx[];
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((g) => g.instructions as unknown as ParsedIx[]);
  let total = 0n;
  for (const ix of [...outer, ...inner]) {
    if (ix.program !== "spl-token" || !ix.parsed?.info) continue;
    const { type, info } = ix.parsed;
    if (info.destination !== vault || info.authority !== wallet) continue;
    if (type === "transferChecked" && info.mint === USDC_MINT) total += BigInt((info.tokenAmount as { amount: string }).amount);
    else if (type === "transfer") total += BigInt(info.amount as string);
  }
  return total;
}

/** Waits for a signature to confirm; throws if it fails or takes too long. */
export async function confirmSignature(signature: string, timeoutMs = 60_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { value } = await rpc.getSignatureStatuses([signature as Signature]).send();
    const status = value[0];
    if (status?.err) throw new Error("The transaction failed on chain.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("The transaction was not confirmed in time. It may still land; check the explorer.");
}

// ------------------------------------------------------------------ format

export const usdc = (micro: number | bigint | null | undefined, digits = 2) =>
  micro === null || micro === undefined
    ? "—"
    : `${(Number(micro) / 10 ** USDC_DECIMALS).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} USDC`;

export const sol = (lamports: bigint | number) =>
  `${(Number(lamports) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 3 })} SOL`;

export const shortAddress = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`;
