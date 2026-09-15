// vault-refund — returns declined allocations from the program's vault.
//
// Called by pg_cron (private.dispatch_refunds) when a wallet allocation is
// refund_due, with the anchoring secret in x-anchor-secret. For each claimed
// refund it sends one transaction, signed by the operator: create the
// investor's USDC account if it is missing, then the program's vault_transfer
// of the amount deposited, into that account.
//
// Never sent twice. The signature and the blockhash's last valid block height
// are recorded before sending. A refund that already has a signature is looked
// up on chain instead: confirmed, it is recorded as done; failed, it is left
// for a human; not found once that height has passed, it can no longer land,
// and only then is a new transaction signed.
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
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { findVaultAuthorityPda, getVaultTransferInstructionAsync } from "../_shared/audit-client/index.ts";

/** Circle's USDC on Solana devnet. */
const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

interface Refund {
  id: string;
  wallet_address: string;
  amount_micro_usdc: number;
  refund_signature: string | null;
  refund_valid_until: number | null;
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

async function vaultAccount() {
  const [authority] = await findVaultAuthorityPda();
  const [vault] = await findAssociatedTokenPda({ owner: authority, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return vault;
}

type Status = "confirmed" | "failed" | "unknown";

async function statusOf(signature: string): Promise<{ status: Status; error?: string }> {
  const { value } = await rpc.getSignatureStatuses([signature as never], { searchTransactionHistory: true }).send();
  const s = value[0];
  if (!s) return { status: "unknown" };
  if (s.err) return { status: "failed", error: `transaction failed: ${JSON.stringify(s.err)}` };
  return s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized"
    ? { status: "confirmed" }
    : { status: "unknown" };
}

/** Signs, records the signature, then sends. Returns the signature. */
async function sendRefund(r: Refund): Promise<string> {
  const signer = await getOperator();
  const owner = address(r.wallet_address);
  const [destination] = await findAssociatedTokenPda({ owner, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const instructions = [
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: signer, owner, mint: USDC_MINT }),
    await getVaultTransferInstructionAsync({
      operator: signer,
      vault: await vaultAccount(),
      mint: USDC_MINT,
      destination,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      amount: BigInt(r.amount_micro_usdc),
    }),
  ];
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
  const { error } = await db.rpc("refund_sending", {
    p_id: r.id, p_signature: signature, p_valid_until: Number(blockhash.lastValidBlockHeight),
  });
  if (error) throw new Error(`could not record the signature: ${error.message}`);
  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", preflightCommitment: "confirmed" })
    .send();
  return signature;
}

async function refund(r: Refund): Promise<{ id: string; outcome: string; signature?: string }> {
  let signature = r.refund_signature;
  if (signature) {
    const { status, error } = await statusOf(signature);
    if (status === "failed") {
      await db.rpc("refund_failed", { p_id: r.id, p_error: error ?? "failed" });
      return { id: r.id, outcome: "failed", signature };
    }
    if (status === "unknown") {
      const height = Number(await rpc.getBlockHeight({ commitment: "confirmed" }).send());
      if (r.refund_valid_until === null || height <= r.refund_valid_until) {
        return { id: r.id, outcome: "pending", signature }; // may still land; the next run looks again
      }
      signature = null; // expired without landing: safe to send a new one
    }
  }
  if (!signature) signature = await sendRefund(r);

  for (let i = 0; i < 20; i++) {
    const { status, error } = await statusOf(signature);
    if (status === "confirmed") {
      const { error: doneError } = await db.rpc("refund_done", { p_id: r.id, p_signature: signature });
      if (doneError) throw new Error(`refund landed but was not recorded: ${doneError.message}`);
      return { id: r.id, outcome: "refunded", signature };
    }
    if (status === "failed") {
      await db.rpc("refund_failed", { p_id: r.id, p_error: error ?? "failed" });
      return { id: r.id, outcome: "failed", signature };
    }
    await sleep(1_500);
  }
  return { id: r.id, outcome: "pending", signature };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }
  const { data, error } = await db.rpc("refund_claim", { p_limit: 5 });
  if (error) return Response.json({ error: `claim failed: ${error.message}` }, { status: 500 });

  const results = [];
  for (const r of (data ?? []) as Refund[]) {
    try {
      results.push(await refund(r));
    } catch (err) {
      // Left claimed: the claim expires in two minutes and the next run
      // resumes from the recorded signature, if there is one.
      results.push({ id: r.id, outcome: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return Response.json({ processed: results.length, results });
});
