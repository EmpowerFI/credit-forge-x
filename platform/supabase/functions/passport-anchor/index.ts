// passport-anchor — writes the Business Passport's batches to Solana devnet.
//
// Called every hour by pg_cron (private.dispatch_passport_anchor) with a
// shared secret in x-passport-anchor-secret. Each run:
//
//   1. commits to every snapshot that has no commitment yet (salted, so the
//      published hash cannot be tested against a guess of her figures);
//   2. finishes the batch in flight, if there is one -- or, at most once a
//      day, opens the next: every committed snapshot and signed credential
//      not yet in a batch, as leaves of an RFC 9162 Merkle tree;
//   3. writes the root in a Memo signed by the anchoring key, and records the
//      signature, slot and block time once it confirms.
//
// The signature is recorded before the transaction is sent. A run that dies
// in between leaves a signature the next run looks up: confirmed, it is
// recorded; failed, or expired without landing, the batch is signed again.
// One batch is in flight at a time, so a root is never written twice.
//
// Secrets: PASSPORT_ANCHOR_KEYPAIR (Solana keypair, JSON byte array),
// PASSPORT_ANCHOR_AUTHORITY (its public address, checked against it),
// PASSPORT_ANCHOR_SECRET; optional SOLANA_RPC_URL (default: public devnet).
// All three from scripts/passport/generate-anchor-key.mts.

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
import {
  type Canonical, credentialCommitment, hex, inclusionProof, leafHash, merkleRoot, snapshotCommitment, unhex,
} from "../_shared/passport/index.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const MEMO_PROGRAM = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

let signer: KeyPairSigner | undefined;
async function authority(): Promise<KeyPairSigner> {
  if (!signer) {
    signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(env("PASSPORT_ANCHOR_KEYPAIR"))));
    if (signer.address !== env("PASSPORT_ANCHOR_AUTHORITY")) {
      throw new Error("PASSPORT_ANCHOR_KEYPAIR is not the key PASSPORT_ANCHOR_AUTHORITY publishes");
    }
  }
  return signer;
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

interface Batch {
  id: string;
  batch_no: number;
  root: string;
  size: number;
  memo: string;
  status: "pending" | "sent" | "confirmed";
  signature: string | null;
  last_valid_block_height: number | null;
}

// ------------------------------------------------------------- the leaves

async function commitSnapshots(): Promise<number> {
  const pending = await call<{ id: string; payload: Canonical }[]>("passport_snapshots_uncommitted");
  for (const s of pending) {
    await call("passport_snapshot_commit", {
      p_snapshot_id: s.id,
      p_commitment: hex(await snapshotCommitment(s.payload)),
    });
  }
  return pending.length;
}

async function openBatch(): Promise<Batch | null> {
  const leaves = await call<{ kind: "snapshot" | "credential"; id: string; commitment?: string; jwt?: string }[]>(
    "passport_unbatched",
  );
  if (leaves.length === 0) return null;
  const commitments = await Promise.all(
    leaves.map(async (l) => l.kind === "snapshot" ? unhex(l.commitment!) : await credentialCommitment(l.jwt!)),
  );
  const hashed = await Promise.all(commitments.map(leafHash));
  const root = hex(await merkleRoot(hashed));
  const withProofs = await Promise.all(leaves.map(async (l, i) => ({
    kind: l.kind,
    id: l.id,
    commitment: hex(commitments[i]),
    proof: (await inclusionProof(hashed, i)).map(hex),
  })));
  return await call<Batch>("passport_batch_create", { p_root: root, p_leaves: withProofs });
}

// ---------------------------------------------------------------- the chain

async function send(batch: Batch): Promise<void> {
  const key = await authority();
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const memo: Instruction = {
    programAddress: MEMO_PROGRAM,
    accounts: [{ address: key.address, role: AccountRole.READONLY_SIGNER, signer: key } as never],
    data: new TextEncoder().encode(batch.memo),
  };
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(key, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstruction(memo, m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  // Kept first: if this run dies after sending, the next one finds it.
  await call("passport_batch_sent", {
    p_id: batch.id,
    p_signature: signature,
    p_last_valid_block_height: Number(blockhash.lastValidBlockHeight),
    p_authority: key.address,
  });
  batch.status = "sent";
  batch.signature = signature;
  batch.last_valid_block_height = Number(blockhash.lastValidBlockHeight);
  try {
    await rpc.sendTransaction(getBase64EncodedWireTransaction(transaction), {
      encoding: "base64",
      preflightCommitment: "confirmed",
    }).send();
  } catch (error) {
    await call("passport_batch_retry", { p_id: batch.id, p_error: `send: ${String(error)}` });
    throw error;
  }
}

/** Confirmed, failed, expired unseen, or still waiting after about forty seconds. */
async function settle(batch: Batch): Promise<"confirmed" | "retry" | "waiting"> {
  const signature = batch.signature as Signature;
  for (let i = 0; i < 20; i++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
    if (status?.err) {
      await call("passport_batch_retry", { p_id: batch.id, p_error: `transaction failed: ${JSON.stringify(status.err)}` });
      return "retry";
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      const tx = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: "json" }).send();
      const blockTime = tx?.blockTime ? new Date(Number(tx.blockTime) * 1000).toISOString() : null;
      await call("passport_batch_confirmed", { p_id: batch.id, p_slot: Number(status.slot), p_block_time: blockTime });
      return "confirmed";
    }
    if (!status) {
      const height = Number(await rpc.getBlockHeight({ commitment: "confirmed" }).send());
      if (height > Number(batch.last_valid_block_height)) {
        await call("passport_batch_retry", { p_id: batch.id, p_error: "expired without landing" });
        return "retry";
      }
    }
    await sleep(2_000);
  }
  await call("passport_batch_note", { p_id: batch.id, p_error: "not confirmed yet; checked again next run" });
  return "waiting";
}

async function drive(batch: Batch): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (batch.status === "pending") await send(batch);
    const outcome = await settle(batch);
    if (outcome !== "retry") return outcome;
    batch.status = "pending";
    batch.signature = null;
  }
  return "retry";
}

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get("x-passport-anchor-secret"), env("PASSPORT_ANCHOR_SECRET"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  try {
    const committed = await commitSnapshots();
    let batch = await call<Batch | null>("passport_batch_open");
    let opened = false;
    if (!batch) {
      batch = await openBatch();
      opened = batch !== null;
    }
    const outcome = batch ? await drive(batch) : "idle";
    return new Response(JSON.stringify({ committed, batch: batch?.batch_no ?? null, opened, outcome }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("passport-anchor failed", String(error));
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
