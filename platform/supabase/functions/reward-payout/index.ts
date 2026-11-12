// reward-payout — works through public.payout_ops on Solana devnet
// (programs/empowerfi-rewards, 20270104):
//
//   set_payout       where her reward wallet pays out (a new destination waits a day);
//   withdraw_reward  everything her wallet holds, to that destination;
//   withdraw_house   what is left of EmpowerFI's half of a campaign, to its house wallet.
//
// One transaction at a time, the one in flight first. As in campaign-attest,
// the signature is written before the transaction is sent, so a run that dies
// in between leaves a signature the next one looks up.
//
// Called by pg_cron every ten minutes (x-campaign-attest-secret), and right
// after the diary or the dashboard asks, with the caller's session: any
// signed-in caller may only make the queue move; what is in it was checked by
// the database when it was asked for.
//
// Secrets: CAMPAIGN_OPERATOR_KEYPAIR, CAMPAIGN_OPERATOR_AUTHORITY,
// CAMPAIGN_ATTEST_SECRET (all campaign-attest's); optional SOLANA_RPC_URL.

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
  type Signature,
} from "@solana/kit";
import {
  type PayoutPlan,
  setPayoutInstructions,
  tokensOf,
  walletOf,
  withdrawHouseInstructions,
  withdrawRewardInstructions,
} from "../_shared/campaign-pay.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

let signer: KeyPairSigner | undefined;
async function operator(): Promise<KeyPairSigner> {
  if (!signer) {
    signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(env("CAMPAIGN_OPERATOR_KEYPAIR"))));
    if (signer.address !== env("CAMPAIGN_OPERATOR_AUTHORITY")) {
      throw new Error("CAMPAIGN_OPERATOR_KEYPAIR is not the key CAMPAIGN_OPERATOR_AUTHORITY publishes");
    }
  }
  return signer;
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

interface Op extends PayoutPlan {
  id: string;
  status: "pending" | "sent";
  signature: string | null;
  last_valid_block_height: number | null;
  wallet_address: string | null;
  operator_wallet: string;
  house_left_units: number | null;
}

/** A token account's balance, or 0 when it does not exist yet. */
async function tokenBalance(owner: string, mint: string): Promise<bigint> {
  const { value } = await rpc.getTokenAccountBalance(await tokensOf(owner, mint), { commitment: "confirmed" }).send()
    .catch(() => ({ value: { amount: "0" } }));
  return BigInt(value.amount);
}

/** What will go out: her whole balance, or what is left of EmpowerFI's half (the program takes exactly that). */
async function amountOf(op: Op): Promise<bigint | null> {
  if (op.kind === "withdraw_reward") return await tokenBalance(await walletOf(op.wallet_ref!, op.program_address), op.mint);
  if (op.kind === "withdraw_house") return BigInt(op.house_left_units ?? 0);
  return null;
}

async function send(op: Op): Promise<void> {
  const key = await operator();
  if (!op.campaign_address) throw new Error("no campaign to act through");
  if (key.address !== op.operator_wallet) throw new Error(`campaign ${op.campaign_address} is run by ${op.operator_wallet}`);
  if (op.wallet_ref && op.wallet_address && op.wallet_address !== await walletOf(op.wallet_ref, op.program_address)) {
    throw new Error("the recorded address is not the wallet's");
  }
  const amount = await amountOf(op);
  if (amount === 0n) {
    await call("payout_op_failed", { p_id: op.id, p_error: "nothing to send" });
    throw new Error("nothing to send");
  }
  const ixs = op.kind === "set_payout"
    ? await setPayoutInstructions(key, op)
    : op.kind === "withdraw_reward"
    ? await withdrawRewardInstructions(key, op)
    : await withdrawHouseInstructions(key, op);
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(key, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(ixs, m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  await call("payout_op_sent", {
    p_id: op.id,
    p_signature: signature,
    p_last_valid_block_height: Number(blockhash.lastValidBlockHeight),
    p_amount_units: amount === null ? null : Number(amount),
  });
  op.status = "sent";
  op.signature = signature;
  op.last_valid_block_height = Number(blockhash.lastValidBlockHeight);
  try {
    await rpc.sendTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", preflightCommitment: "confirmed" }).send();
  } catch (error) {
    // Refused at preflight: the program said no. Given up; she can ask again.
    await call("payout_op_failed", { p_id: op.id, p_error: `send: ${String(error)}` });
    throw error;
  }
}

async function settle(op: Op): Promise<"confirmed" | "retry" | "failed" | "waiting"> {
  const signature = op.signature as Signature;
  for (let i = 0; i < 20; i++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
    if (status?.err) {
      await call("payout_op_failed", { p_id: op.id, p_error: `transaction failed: ${JSON.stringify(status.err)}` });
      return "failed";
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      const tx = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: "json" }).send();
      const blockTime = tx?.blockTime ? new Date(Number(tx.blockTime) * 1000).toISOString() : null;
      await call("payout_op_confirmed", { p_id: op.id, p_slot: Number(status.slot), p_block_time: blockTime });
      return "confirmed";
    }
    if (!status) {
      const height = Number(await rpc.getBlockHeight({ commitment: "confirmed" }).send());
      if (height > Number(op.last_valid_block_height)) {
        await call("payout_op_retry", { p_id: op.id, p_error: "expired without landing" });
        return "retry";
      }
    }
    await sleep(2_000);
  }
  await call("payout_op_note", { p_id: op.id, p_error: "not confirmed yet; checked again next run" });
  return "waiting";
}

async function drive(op: Op): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (op.status === "pending") await send(op);
    const outcome = await settle(op);
    if (outcome !== "retry") return outcome;
    op.status = "pending";
    op.signature = null;
  }
  return "retry";
}

/** The cron's secret, or any signed-in caller of this project. */
async function allowed(req: Request): Promise<boolean> {
  if (secretMatches(req.headers.get("x-campaign-attest-secret"), env("CAMPAIGN_ATTEST_SECRET"))) return true;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await db.auth.getUser(token);
  return !error && Boolean(data.user);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (!(await allowed(req))) return json({ error: "forbidden" }, 403);
  try {
    const done: { kind: string; outcome: string }[] = [];
    for (let n = 0; n < 10; n++) {
      const op = await call<Op | null>("payout_op_next");
      if (!op) break;
      let outcome: string;
      try {
        outcome = await drive(op);
      } catch (error) {
        console.error("payout failed", op.kind, String(error));
        outcome = "failed";
      }
      done.push({ kind: op.kind, outcome });
      if (outcome === "waiting" || outcome === "retry") break;
    }
    return json({ done });
  } catch (error) {
    console.error("reward-payout failed", String(error));
    return json({ error: String(error) }, 500);
  }
});
