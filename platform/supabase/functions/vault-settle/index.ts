// vault-settle — sends the real legs of settlement from the program's vault.
//
// Called by pg_cron (private.dispatch_settlement) with the anchoring secret in
// x-anchor-secret, when a leg is due. The database groups due legs into
// transfers (public.settle_claim); each transfer is one transaction, signed by
// the operator, who also plays the regulated ramp partner on devnet:
//
//   release  the vault's program-signed vault_transfer of the released
//            deposits into the ramp's USDC account (the operator's). Every
//            release due at the same time leaves in one transfer.
//   payout   the ramp sends the instalment's real shares into the vault
//            (a token transfer), then vault_transfer pays each investor's
//            share to their wallet, creating their USDC account if needed.
//
// Never sent twice: the signature and the blockhash's last valid block height
// are recorded before sending; a transfer that already has one is looked up on
// chain instead, and signed anew only once that height has passed unlanded.
//
// Secrets: OPERATOR_KEYPAIR, ANCHOR_CRON_SECRET, optional SOLANA_RPC_URL;
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  type Instruction,
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { findVaultAuthorityPda, getVaultTransferInstructionAsync } from "../_shared/audit-client/index.ts";

/** Circle's USDC on Solana devnet. */
const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const USDC_DECIMALS = 6;

interface Transfer {
  id: number;
  kind: "release" | "payout";
  inflow_micro_usdc: number;
  outflow_micro_usdc: number;
  signature: string | null;
  valid_until: number | null;
  legs: { leg_id: string; amount_micro_usdc: number; destination: string | null }[];
}

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let operator: KeyPairSigner | undefined;
const getOperator = async () =>
  (operator ??= await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(env("OPERATOR_KEYPAIR")))));

function secretMatches(given: string | null, expected: string): boolean {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function usdcAccount(owner: ReturnType<typeof address>) {
  const [ata] = await findAssociatedTokenPda({ owner, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

async function vaultAccount() {
  const [authority] = await findVaultAuthorityPda();
  return usdcAccount(authority);
}

async function operatorUsdc(): Promise<bigint> {
  try {
    const { value } = await rpc.getTokenAccountBalance(await usdcAccount((await getOperator()).address), { commitment: "confirmed" }).send();
    return BigInt(value.amount);
  } catch {
    return 0n;
  }
}

type Status = "confirmed" | "failed" | "unknown";

async function statusOf(signature: string): Promise<{ status: Status; error?: string }> {
  const { value } = await rpc.getSignatureStatuses([signature as never], { searchTransactionHistory: true }).send();
  const s = value[0];
  if (!s) return { status: "unknown" };
  if (s.err) return { status: "failed", error: `transaction failed: ${JSON.stringify(s.err)}` };
  return s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized" ? { status: "confirmed" } : { status: "unknown" };
}

async function instructionsFor(t: Transfer): Promise<Instruction[]> {
  const signer = await getOperator();
  const vault = await vaultAccount();
  const ramp = await usdcAccount(signer.address);
  if (t.kind === "release") {
    return [
      await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: signer, owner: signer.address, mint: USDC_MINT }),
      await getVaultTransferInstructionAsync({
        operator: signer, vault, mint: USDC_MINT, destination: ramp, tokenProgram: TOKEN_PROGRAM_ADDRESS,
        amount: BigInt(t.outflow_micro_usdc),
      }),
    ];
  }
  const out: Instruction[] = [
    getTransferCheckedInstruction({
      source: ramp, mint: USDC_MINT, destination: vault, authority: signer,
      amount: BigInt(t.inflow_micro_usdc), decimals: USDC_DECIMALS,
    }),
  ];
  for (const leg of t.legs) {
    if (!leg.destination) throw new Error(`payout leg ${leg.leg_id} has no wallet`);
    const owner = address(leg.destination);
    out.push(
      await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: signer, owner, mint: USDC_MINT }),
      await getVaultTransferInstructionAsync({
        operator: signer, vault, mint: USDC_MINT, destination: await usdcAccount(owner), tokenProgram: TOKEN_PROGRAM_ADDRESS,
        amount: BigInt(leg.amount_micro_usdc),
      }),
    );
  }
  return out;
}

/** Signs, records the signature, then sends. */
async function send(t: Transfer): Promise<string> {
  const signer = await getOperator();
  const instructions = await instructionsFor(t);
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  const { error } = await db.rpc("settle_sending", { p_id: t.id, p_signature: signature, p_valid_until: Number(blockhash.lastValidBlockHeight) });
  if (error) throw new Error(`could not record the signature: ${error.message}`);
  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", preflightCommitment: "confirmed" })
    .send();
  return signature;
}

async function settle(t: Transfer): Promise<{ id: number; kind: string; outcome: string; signature?: string }> {
  let signature = t.signature;
  if (signature) {
    const { status, error } = await statusOf(signature);
    if (status === "failed") {
      await db.rpc("settle_failed", { p_id: t.id, p_error: error ?? "failed" });
      return { id: t.id, kind: t.kind, outcome: "failed", signature };
    }
    if (status === "unknown") {
      const height = Number(await rpc.getBlockHeight({ commitment: "confirmed" }).send());
      if (t.valid_until === null || height <= t.valid_until) return { id: t.id, kind: t.kind, outcome: "pending", signature };
      signature = null; // expired without landing: safe to sign a new one
    }
  }
  if (!signature) {
    // The ramp must hold what a payout brings back; short, sign nothing and let the claim lapse.
    if (t.inflow_micro_usdc > 0 && (await operatorUsdc()) < BigInt(t.inflow_micro_usdc)) {
      return { id: t.id, kind: t.kind, outcome: "ramp_needs_usdc" };
    }
    signature = await send(t);
  }

  for (let i = 0; i < 20; i++) {
    const { status, error } = await statusOf(signature);
    if (status === "confirmed") {
      const { error: doneError } = await db.rpc("settle_done", { p_id: t.id, p_signature: signature });
      if (doneError) throw new Error(`transfer landed but was not recorded: ${doneError.message}`);
      return { id: t.id, kind: t.kind, outcome: "confirmed", signature };
    }
    if (status === "failed") {
      await db.rpc("settle_failed", { p_id: t.id, p_error: error ?? "failed" });
      return { id: t.id, kind: t.kind, outcome: "failed", signature };
    }
    await sleep(1_500);
  }
  return { id: t.id, kind: t.kind, outcome: "pending", signature };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }
  const { data, error } = await db.rpc("settle_claim", { p_per_transfer: 4 });
  if (error) return Response.json({ error: `claim failed: ${error.message}` }, { status: 500 });

  const results = [];
  for (const t of (data ?? []) as Transfer[]) {
    try {
      results.push(await settle(t));
    } catch (err) {
      // Left claimed: the claim lapses in two minutes and the next run resumes
      // from the recorded signature, if there is one.
      results.push({ id: t.id, kind: t.kind, outcome: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return Response.json({ processed: results.length, results });
});
