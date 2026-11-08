// campaign-attest — writes each campaign's engagement to its vault on Solana
// devnet (programs/empowerfi-rewards, attest_engagement).
//
// Called once a day by pg_cron (private.dispatch_campaign_attest) with a
// shared secret in x-campaign-attest-secret. Each run finishes the
// attestation in flight, if there is one, and otherwise opens the next
// campaign's: how many women are in it, how many have kept the 30 days, and
// the Merkle root of their salted leaves. The database opens one only for a
// campaign with at least five women.
//
// Then it pays (pay_reward): each woman of a campaign's latest confirmed root
// who is not paid yet gets her share into her reward wallet -- the program's
// address [recipient, her wallet ref], whose token account the same
// transaction creates if it is missing. And it writes the address of every
// new wallet beside its ref, so the database can name it.
//
// As in passport-anchor, the signature is recorded before the transaction is
// sent: a run that dies in between leaves a signature the next one looks up.
//
// Secrets: CAMPAIGN_OPERATOR_KEYPAIR (Solana keypair, JSON byte array),
// CAMPAIGN_OPERATOR_AUTHORITY (its public address), CAMPAIGN_ATTEST_SECRET;
// optional SOLANA_RPC_URL. All from scripts/rewards/generate-keys.mts. The
// operator attests and pays, and the program pays only a leaf of the attested
// root, once, into that leaf's own wallet, never from EmpowerFI's half.

import { createClient } from "@supabase/supabase-js";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
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
  type Signature,
} from "@solana/kit";
import { attestEngagementData, engagementRoot } from "../_shared/campaign.ts";
import { payRewardInstructions, walletOf } from "../_shared/campaign-pay.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

interface Attestation {
  id: string;
  program_id: string;
  program_address: string;
  campaign_address: string;
  operator_wallet: string;
  enrolled: number;
  engaged: number;
  root: string;
  status: "pending" | "sent" | "confirmed";
  signature: string | null;
  last_valid_block_height: number | null;
}

async function open(): Promise<Attestation | null> {
  const due = await call<{ program_id: string; as_of: string; enrolled: number; leaves: string[] } | null>(
    "campaign_attestation_due",
  );
  if (!due) return null;
  return await call<Attestation>("campaign_attestation_create", {
    p_program_id: due.program_id,
    p_as_of: due.as_of,
    p_enrolled: due.enrolled,
    p_root: await engagementRoot(due.leaves),
    p_leaves: due.leaves,
  });
}

async function send(a: Attestation): Promise<void> {
  const key = await operator();
  if (key.address !== a.operator_wallet) throw new Error(`campaign ${a.campaign_address} is attested by ${a.operator_wallet}`);
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const ix: Instruction = {
    programAddress: address(a.program_address),
    accounts: [
      { address: key.address, role: AccountRole.READONLY_SIGNER, signer: key } as never,
      { address: address(a.campaign_address), role: AccountRole.WRITABLE },
    ],
    data: await attestEngagementData(a.enrolled, a.engaged, a.root),
  };
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(key, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstruction(ix, m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  await call("campaign_attestation_sent", {
    p_id: a.id,
    p_signature: signature,
    p_last_valid_block_height: Number(blockhash.lastValidBlockHeight),
  });
  a.status = "sent";
  a.signature = signature;
  a.last_valid_block_height = Number(blockhash.lastValidBlockHeight);
  try {
    await rpc.sendTransaction(getBase64EncodedWireTransaction(transaction), {
      encoding: "base64",
      preflightCommitment: "confirmed",
    }).send();
  } catch (error) {
    await call("campaign_attestation_retry", { p_id: a.id, p_error: `send: ${String(error)}` });
    throw error;
  }
}

async function settle(a: Attestation): Promise<"confirmed" | "retry" | "waiting"> {
  const signature = a.signature as Signature;
  for (let i = 0; i < 20; i++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
    if (status?.err) {
      await call("campaign_attestation_retry", { p_id: a.id, p_error: `transaction failed: ${JSON.stringify(status.err)}` });
      return "retry";
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      const tx = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: "json" }).send();
      const blockTime = tx?.blockTime ? new Date(Number(tx.blockTime) * 1000).toISOString() : null;
      await call("campaign_attestation_confirmed", { p_id: a.id, p_slot: Number(status.slot), p_block_time: blockTime });
      return "confirmed";
    }
    if (!status) {
      const height = Number(await rpc.getBlockHeight({ commitment: "confirmed" }).send());
      if (height > Number(a.last_valid_block_height)) {
        await call("campaign_attestation_retry", { p_id: a.id, p_error: "expired without landing" });
        return "retry";
      }
    }
    await sleep(2_000);
  }
  await call("campaign_attestation_note", { p_id: a.id, p_error: "not confirmed yet; checked again next run" });
  return "waiting";
}

async function drive(a: Attestation): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (a.status === "pending") await send(a);
    const outcome = await settle(a);
    if (outcome !== "retry") return outcome;
    a.status = "pending";
    a.signature = null;
  }
  return "retry";
}

// ------------------------------------------------------------ wallets

/** Writes the address of each wallet created since the last run. */
async function addressWallets(): Promise<number> {
  const refs = await call<string[]>("reward_wallets_unaddressed", { p_limit: 500 });
  for (const ref of refs) {
    await call("reward_wallet_addressed", { p_ref: ref, p_address: await walletOf(ref) });
  }
  return refs.length;
}

// ------------------------------------------------------------ paying

interface Payment {
  id: string;
  program_id: string;
  wallet_ref: string;
  recipient_address: string;
  amount_units: number;
  leaf: string;
  status: "pending" | "sent" | "confirmed";
  signature: string | null;
  last_valid_block_height: number | null;
}

interface PaymentDue {
  program_id: string;
  program_address: string;
  campaign_address: string;
  vault_address: string;
  mint: string;
  operator_wallet: string;
  wallet_ref: string;
  recipient_address: string;
  salt: string;
  leaf: string;
  index: number;
  leaves: string[];
  amount_units: number;
}

/** What a payment's transaction needs, kept with it until it lands. */
const plans = new Map<string, PaymentDue>();

async function openPayment(): Promise<Payment | null> {
  const due = await call<PaymentDue | null>("campaign_payment_due");
  if (!due) return null;
  const p = await call<Payment>("campaign_payment_create", {
    p_program_id: due.program_id,
    p_wallet_ref: due.wallet_ref,
    p_recipient_address: due.recipient_address,
    p_amount_units: due.amount_units,
    p_leaf: due.leaf,
  });
  plans.set(p.id, due);
  return p;
}

async function sendPayment(p: Payment): Promise<void> {
  const due = plans.get(p.id);
  // A payment left pending by a run that died: given up, so the next due is rebuilt from the latest root.
  if (!due) {
    await call("campaign_payment_failed", { p_id: p.id, p_error: "left pending by an earlier run; rebuilt" });
    throw new Error("stale pending payment");
  }
  const key = await operator();
  if (key.address !== due.operator_wallet) throw new Error(`campaign ${due.campaign_address} is paid by ${due.operator_wallet}`);
  if (due.recipient_address !== await walletOf(due.wallet_ref)) throw new Error("the recorded address is not the wallet's");
  const [createTokens, pay] = await payRewardInstructions(key, due);
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(key, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstruction(createTokens, m),
      (m) => appendTransactionMessageInstruction(pay, m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  await call("campaign_payment_sent", {
    p_id: p.id,
    p_signature: signature,
    p_last_valid_block_height: Number(blockhash.lastValidBlockHeight),
  });
  p.status = "sent";
  p.signature = signature;
  p.last_valid_block_height = Number(blockhash.lastValidBlockHeight);
  try {
    await rpc.sendTransaction(getBase64EncodedWireTransaction(transaction), {
      encoding: "base64",
      preflightCommitment: "confirmed",
    }).send();
  } catch (error) {
    // Refused at preflight: the program said no (a newer root, say). The next run rebuilds it.
    await call("campaign_payment_failed", { p_id: p.id, p_error: `send: ${String(error)}` });
    throw error;
  }
}

async function settlePayment(p: Payment): Promise<"confirmed" | "retry" | "failed" | "waiting"> {
  const signature = p.signature as Signature;
  for (let i = 0; i < 20; i++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
    if (status?.err) {
      await call("campaign_payment_failed", { p_id: p.id, p_error: `transaction failed: ${JSON.stringify(status.err)}` });
      return "failed";
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      const tx = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: "json" }).send();
      const blockTime = tx?.blockTime ? new Date(Number(tx.blockTime) * 1000).toISOString() : null;
      await call("campaign_payment_confirmed", { p_id: p.id, p_slot: Number(status.slot), p_block_time: blockTime });
      return "confirmed";
    }
    if (!status) {
      const height = Number(await rpc.getBlockHeight({ commitment: "confirmed" }).send());
      if (height > Number(p.last_valid_block_height)) {
        await call("campaign_payment_retry", { p_id: p.id, p_error: "expired without landing" });
        return "retry";
      }
    }
    await sleep(2_000);
  }
  await call("campaign_payment_note", { p_id: p.id, p_error: "not confirmed yet; checked again next run" });
  return "waiting";
}

async function drivePayment(p: Payment): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (p.status === "pending") await sendPayment(p);
    const outcome = await settlePayment(p);
    if (outcome !== "retry") return outcome;
    p.status = "pending";
    p.signature = null;
  }
  return "retry";
}

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get("x-campaign-attest-secret"), env("CAMPAIGN_ATTEST_SECRET"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  try {
    // Every campaign due today, one after the other; the one in flight first.
    const done: { campaign: string; outcome: string }[] = [];
    for (let n = 0; n < 20; n++) {
      const a = (await call<Attestation | null>("campaign_attestation_open")) ?? (await open());
      if (!a) break;
      const outcome = await drive(a);
      done.push({ campaign: a.campaign_address, outcome });
      if (outcome !== "confirmed") break;
    }
    const addressed = await addressWallets();
    // Then the rewards: the one in flight first, then each woman due, one transaction each.
    const paid: { recipient: string; outcome: string }[] = [];
    for (let n = 0; n < 25; n++) {
      const p = (await call<Payment | null>("campaign_payment_open")) ?? (await openPayment());
      if (!p) break;
      let outcome: string;
      try {
        outcome = await drivePayment(p);
      } catch (error) {
        console.error("payment failed", p.recipient_address, String(error));
        outcome = "failed";
      }
      paid.push({ recipient: p.recipient_address, outcome });
      // Anything but a landed payment waits for the next run: a refusal usually
      // means the root moved, and every payment of that campaign would fail too.
      if (outcome !== "confirmed") break;
    }
    return new Response(JSON.stringify({ done, addressed, paid }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("campaign-attest failed", String(error));
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
