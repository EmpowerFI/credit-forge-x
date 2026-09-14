// anchor-submit — writes queued commitments to the empowerfi_audit program.
//
// Called every 10s by pg_cron (private.dispatch_anchor_jobs) when a job is
// due, with a shared secret in x-anchor-secret. Each run claims a few jobs,
// computes each commitment from the payload the database builds, sends the
// instruction signed by the operator key, waits for confirmation and records
// signature, slot and account. A dependent job (verification after
// registration, enrollment after verification) is claimed on a later round
// once its dependency has confirmed.
//
// Idempotent by construction: before sending, it looks for the account on
// chain. If it already holds the same commitment — a previous run confirmed
// but died before recording — the signature is recovered instead of writing
// twice. If it holds a different one, the job fails for good: that is a
// mismatch for a human to look at, not something to retry.
//
// Secrets (supabase secrets set): OPERATOR_KEYPAIR (JSON byte array),
// ANCHOR_CRON_SECRET; optional SOLANA_RPC_URL. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.

import { createClient } from "@supabase/supabase-js";
import {
  type Address,
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
} from "@solana/kit";
import {
  ANCHOR_DOMAINS,
  type AnchorKind,
  type CanonicalObject,
  commit,
  fromHex,
  hashBorrowerRef,
  sameCommitment,
  toHex,
} from "../_shared/audit-commitments/index.ts";
import {
  CommunityStatus,
  fetchMaybeBorrowerAudit,
  fetchMaybeCommunityAudit,
  findBorrowerPda,
  findCommunityPda,
  getRegisterBorrowerRefInstructionAsync,
  getRegisterCommunityInstructionAsync,
  getVerifyCommunityInstructionAsync,
} from "../_shared/audit-client/index.ts";

interface Job {
  id: number;
  kind: AnchorKind;
  entity_id: string;
  attempts: number;
  payload: CanonicalObject | null;
  community_ref: string | null;
  borrower_ref: string | null;
}

interface Proof {
  signature: string;
  slot: number;
  account: Address;
  commitment: Uint8Array;
  recovered: boolean;
}

/** A failure retrying cannot fix. */
class PermanentError extends Error {}

const BATCH = 5;
const TIME_BUDGET_MS = 40_000;

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");

let operator: KeyPairSigner | undefined;
const getOperator = async () =>
  (operator ??= await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(env("OPERATOR_KEYPAIR")))));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function secretMatches(given: string | null, expected: string): boolean {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------------------- chain

async function send(instruction: Instruction): Promise<{ signature: string; slot: number }> {
  const signer = await getOperator();
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstruction(instruction, m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(transaction), {
      encoding: "base64",
      preflightCommitment: "confirmed",
    })
    .send();

  // Poll rather than subscribe: a websocket is one more thing to fail inside
  // a short-lived function, and devnet confirms in a few seconds.
  for (let i = 0; i < 45; i++) {
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status?.err) throw new Error(`transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return { signature, slot: Number(status.slot) };
    }
    await sleep(1_000);
  }
  throw new Error(`not confirmed in time: ${signature}`);
}

/** The signature that wrote an account we found already on chain. */
async function recoverSignature(
  account: Address,
  which: "first" | "latest",
): Promise<{ signature: string; slot: number }> {
  const history = await rpc.getSignaturesForAddress(account, { limit: 50 }).send();
  const ok = history.filter((h) => h.err === null);
  const entry = which === "latest" ? ok[0] : ok[ok.length - 1];
  if (!entry) throw new Error(`account ${account} exists but has no successful signature`);
  return { signature: entry.signature, slot: Number(entry.slot) };
}

const mismatch = (what: string, account: Address) =>
  new PermanentError(`${what} on chain differs from the database (account ${account})`);

// -------------------------------------------------------------------- jobs

async function anchor(job: Job): Promise<Proof> {
  if (!job.payload) throw new PermanentError("no payload: the record is missing or not in an anchorable state");
  if (!job.community_ref) throw new PermanentError("no community ref for this job");

  const commitment = await commit(ANCHOR_DOMAINS[job.kind], job.payload);
  const communityRef = fromHex(job.community_ref);
  const [community] = await findCommunityPda({ communityRef });
  const signer = await getOperator();

  switch (job.kind) {
    case "community": {
      const existing = await fetchMaybeCommunityAudit(rpc, community);
      if (existing.exists) {
        if (!sameCommitment(new Uint8Array(existing.data.commitment), commitment)) {
          throw mismatch("community commitment", community);
        }
        return { ...(await recoverSignature(community, "first")), account: community, commitment, recovered: true };
      }
      const ix = await getRegisterCommunityInstructionAsync({ operator: signer, communityRef, commitment });
      return { ...(await send(ix)), account: community, commitment, recovered: false };
    }

    case "community_verification": {
      const existing = await fetchMaybeCommunityAudit(rpc, community);
      if (!existing.exists) throw new Error("community is not on chain yet");
      if (existing.data.status === CommunityStatus.Verified) {
        if (!sameCommitment(new Uint8Array(existing.data.verificationCommitment), commitment)) {
          throw mismatch("verification commitment", community);
        }
        return { ...(await recoverSignature(community, "latest")), account: community, commitment, recovered: true };
      }
      const ix = await getVerifyCommunityInstructionAsync({
        operator: signer,
        community,
        verificationCommitment: commitment,
      });
      return { ...(await send(ix)), account: community, commitment, recovered: false };
    }

    case "enrollment": {
      if (!job.borrower_ref) throw new PermanentError("no borrower ref for this enrollment");
      const borrowerRefHash = await hashBorrowerRef(fromHex(job.borrower_ref));
      const [borrower] = await findBorrowerPda({ borrowerRefHash });
      const existing = await fetchMaybeBorrowerAudit(rpc, borrower);
      if (existing.exists) {
        if (!sameCommitment(new Uint8Array(existing.data.enrollmentCommitment), commitment)) {
          throw mismatch("enrollment commitment", borrower);
        }
        return { ...(await recoverSignature(borrower, "first")), account: borrower, commitment, recovered: true };
      }
      const ix = await getRegisterBorrowerRefInstructionAsync({
        operator: signer,
        community,
        borrowerRefHash,
        enrollmentCommitment: commitment,
      });
      return { ...(await send(ix)), account: borrower, commitment, recovered: false };
    }
  }
}

async function runJob(job: Job) {
  try {
    const proof = await anchor(job);
    const { error } = await db.rpc("complete_anchor_job", {
      p_id: job.id,
      p_commitment: toHex(proof.commitment),
      p_payload: job.payload,
      p_account_address: proof.account,
      p_signature: proof.signature,
      p_slot: proof.slot,
    });
    if (error) throw new Error(`recording the proof failed: ${error.message}`);
    return { id: job.id, kind: job.kind, outcome: proof.recovered ? "recovered" : "confirmed", signature: proof.signature };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable = !(err instanceof PermanentError);
    await db.rpc("fail_anchor_job", { p_id: job.id, p_error: message, p_retryable: retryable });
    return { id: job.id, kind: job.kind, outcome: retryable ? "retry" : "failed", error: message };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }

  const started = Date.now();
  const results = [];
  // Several rounds per call, so a registration and the verification waiting
  // on it can both land in one run instead of one per cron tick.
  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: jobs, error } = await db.rpc("claim_anchor_jobs", { p_limit: BATCH });
    if (error) {
      return Response.json({ error: `claim failed: ${error.message}`, results }, { status: 500 });
    }
    if (!jobs?.length) break;
    // Sequential: every transaction is signed by the same operator, and devnet
    // rate-limits bursts from one client.
    for (const job of jobs as Job[]) results.push(await runJob(job));
  }

  return Response.json({ processed: results.length, results });
});
