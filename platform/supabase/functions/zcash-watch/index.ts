// zcash-watch — reads EmpowerFI's shielded treasury with its viewing key, and
// credits the vault for payments that have confirmed.
//
// Called every minute by pg_cron (private.dispatch_zcash_watch) with the
// anchoring secret in x-anchor-secret, and by a signed-in investor's "check
// now". Each run:
//
//   1. scans the blocks after the last one scanned (at most MAX_BLOCKS) from
//      a lightwalletd, trial-decrypting every shielded output with the
//      treasury's viewing key (services/zcash-watcher, compiled to WebAssembly);
//   2. fetches each transaction that paid the treasury, decrypts its memos,
//      and hands the database every output it received; the database matches
//      memos to requests and counts confirmations;
//   3. for each confirmed payment, the operator moves the same value in devnet
//      USDC into the program's vault, standing in for NEAR Intents' ZEC→USDC
//      conversion, which has no testnet. The transfer is signed and recorded
//      before it is sent, and never sent twice (the refunds' discipline); once
//      it lands, the database records the allocation, anchored on Solana.
//
// Secrets: OPERATOR_KEYPAIR, ANCHOR_CRON_SECRET, optional SOLANA_RPC_URL and
// ZCASH_LIGHTWALLETD; SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
// from the runtime. The viewing key is in the database, not in the environment.

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
import { findAssociatedTokenPda, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { findVaultAuthorityPda } from "../_shared/audit-client/index.ts";
import {
  blockRangeRequest,
  latestBlockRequest,
  parseLatestBlock,
  transactionRequest,
  ZcashWatcher,
} from "./wasm/zcash_watcher.js";

/** Circle's USDC on Solana devnet. */
const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const USDC_DECIMALS = 6;
/** Blocks per run, and per request to the lightwalletd: keeps a run well inside the CPU budget. */
const MAX_BLOCKS = 300;
const CHUNK = 100;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const LWD = Deno.env.get("ZCASH_LIGHTWALLETD") ?? "https://testnet.zec.rocks";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function secretMatches(given: string | null, expected: string): boolean {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------------------ Zcash

/** One unary or server-streaming call to the lightwalletd, over HTTP/2; the body is gRPC frames. */
async function lwd(method: string, body: Uint8Array): Promise<Uint8Array> {
  const res = await fetch(`${LWD}/cash.z.wallet.sdk.rpc.CompactTxStreamer/${method}`, {
    method: "POST",
    headers: { "content-type": "application/grpc", te: "trailers" },
    body: body as Uint8Array<ArrayBuffer>,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const status = res.headers.get("grpc-status");
  if (status && status !== "0") throw new Error(`${method}: grpc-status ${status} ${res.headers.get("grpc-message") ?? ""}`);
  return new Uint8Array(await res.arrayBuffer());
}

interface Hit { height: number; txid: string; pool: string; index: number; value_zat: number }
interface Scan { from: number | null; to: number | null; blocks: number; last_hash: string | null; hits: Hit[] }
interface Decrypted { txid: string; height: number; outputs: { pool: string; index: number; value_zat: number; memo: string | null }[] }
interface WatchState { network: string; ufvk: string; from_height: number; scanned_hash: string | null; awaiting: number }

async function watch(state: WatchState) {
  const watcher = new ZcashWatcher(state.ufvk);
  try {
    const tip = JSON.parse(parseLatestBlock(await lwd("GetLatestBlock", latestBlockRequest()))) as { height: number };
    const end = Math.min(tip.height, state.from_height + MAX_BLOCKS - 1);
    let hash = state.scanned_hash;
    let scanned = 0;
    let seen = 0;
    let to = state.from_height - 1;

    for (let a = state.from_height; a <= end; a += CHUNK) {
      const b = Math.min(end, a + CHUNK - 1);
      const scan = JSON.parse(watcher.scanBlockRange(await lwd("GetBlockRange", blockRangeRequest(BigInt(a), BigInt(b))))) as Scan;
      if (scan.blocks === 0 || scan.to === null) break; // the server is behind its own tip; next run
      const outputs = [];
      for (const txid of new Set(scan.hits.map((h) => h.txid))) {
        const height = scan.hits.find((h) => h.txid === txid)!.height;
        const d = JSON.parse(watcher.decryptTransaction(await lwd("GetTransaction", transactionRequest(txid)))) as Decrypted;
        for (const o of d.outputs) outputs.push({ txid, pool: o.pool, index: o.index, value_zat: o.value_zat, memo: o.memo, height });
      }
      const { data, error } = await db.rpc("zcash_watch_record", {
        p_tip: tip.height, p_to: scan.to, p_to_hash: scan.last_hash, p_outputs: outputs,
      });
      if (error) throw new Error(`could not record the scan: ${error.message}`);
      seen += (data as { seen: number }).seen;
      scanned += scan.blocks;
      to = scan.to;
      hash = scan.last_hash;
      if (scan.to < b) break;
    }
    // Nothing new to scan still moves the tip on, which is what confirms payments.
    if (scanned === 0) {
      const { error } = await db.rpc("zcash_watch_record", { p_tip: tip.height, p_to: to, p_to_hash: hash, p_outputs: [] });
      if (error) throw new Error(`could not record the tip: ${error.message}`);
    }
    return { tip: tip.height, from: state.from_height, to, blocks: scanned, seen };
  } finally {
    watcher.free();
  }
}

// --------------------------------------------------------------- Solana

interface Credit { id: string; amount_micro_usdc: number; credit_signature: string | null; credit_valid_until: number | null }

let operator: KeyPairSigner | undefined;
const getOperator = async () =>
  (operator ??= await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(env("OPERATOR_KEYPAIR")))));

async function usdcAccount(owner: ReturnType<typeof address>) {
  const [ata] = await findAssociatedTokenPda({ owner, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

async function operatorUsdc(): Promise<bigint> {
  try {
    const { value } = await rpc.getTokenAccountBalance(await usdcAccount((await getOperator()).address), { commitment: "confirmed" }).send();
    return BigInt(value.amount);
  } catch {
    return 0n; // no USDC account yet
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

/** Signs the operator's USDC transfer into the vault, records the signature, then sends it. */
async function sendCredit(c: Credit): Promise<string> {
  const signer = await getOperator();
  const [authority] = await findVaultAuthorityPda();
  const instruction = getTransferCheckedInstruction({
    source: await usdcAccount(signer.address),
    mint: USDC_MINT,
    destination: await usdcAccount(authority),
    authority: signer,
    amount: BigInt(c.amount_micro_usdc),
    decimals: USDC_DECIMALS,
  });
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions([instruction], m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  const { error } = await db.rpc("zcash_credit_sending", {
    p_id: c.id, p_signature: signature, p_valid_until: Number(blockhash.lastValidBlockHeight),
  });
  if (error) throw new Error(`could not record the signature: ${error.message}`);
  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", preflightCommitment: "confirmed" })
    .send();
  return signature;
}

async function credit(c: Credit): Promise<{ id: string; outcome: string; signature?: string }> {
  let signature = c.credit_signature;
  if (signature) {
    const { status, error } = await statusOf(signature);
    if (status === "failed") {
      await db.rpc("zcash_credit_failed", { p_id: c.id, p_error: error ?? "failed" });
      return { id: c.id, outcome: "failed", signature };
    }
    if (status === "unknown") {
      const height = Number(await rpc.getBlockHeight({ commitment: "confirmed" }).send());
      if (c.credit_valid_until === null || height <= c.credit_valid_until) {
        return { id: c.id, outcome: "pending", signature };
      }
      signature = null; // expired without landing: safe to sign a new one
    }
  }
  if (!signature) {
    // Short of USDC, sign nothing: the claim lapses and a later run tries again.
    if ((await operatorUsdc()) < BigInt(c.amount_micro_usdc)) return { id: c.id, outcome: "operator_needs_usdc" };
    signature = await sendCredit(c);
  }

  for (let i = 0; i < 20; i++) {
    const { status, error } = await statusOf(signature);
    if (status === "confirmed") {
      const { error: doneError } = await db.rpc("zcash_credit_done", { p_id: c.id, p_signature: signature });
      if (doneError) throw new Error(`credit landed but was not recorded: ${doneError.message}`);
      return { id: c.id, outcome: "credited", signature };
    }
    if (status === "failed") {
      await db.rpc("zcash_credit_failed", { p_id: c.id, p_error: error ?? "failed" });
      return { id: c.id, outcome: "failed", signature };
    }
    await sleep(1_500);
  }
  return { id: c.id, outcome: "pending", signature };
}

// ------------------------------------------------------------------ entry

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // The cron, or any signed-in user asking for a fresh look.
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "unauthorized" }, 401);
    const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: who, error } = await asCaller.auth.getUser();
    if (error || !who.user) return json({ error: "unauthorized" }, 401);
  }

  const { data: state, error: stateError } = await db.rpc("zcash_watch_state");
  if (stateError) return json({ error: `state: ${stateError.message}` }, 500);
  if (!state) return json({ configured: false });

  let scan;
  try {
    scan = await watch(state as WatchState);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }

  const { data: claimed, error: claimError } = await db.rpc("zcash_credit_claim", { p_limit: 5 });
  if (claimError) return json({ scan, error: `claim failed: ${claimError.message}` }, 500);
  const credits = [];
  for (const c of (claimed ?? []) as Credit[]) {
    try {
      credits.push(await credit(c));
    } catch (err) {
      credits.push({ id: c.id, outcome: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return json({ scan, credits });
});
