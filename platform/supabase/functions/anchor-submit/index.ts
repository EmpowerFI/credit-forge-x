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
  fetchMaybeCheckinCommitment,
  fetchMaybeCommunityAudit,
  fetchMaybeReadinessAttestation,
  findAttestationPda,
  findBorrowerPda,
  findCheckinPda,
  findCommunityPda,
  getAnchorCheckinInstructionAsync,
  getAttestReadinessInstructionAsync,
  getRegisterBorrowerRefInstructionAsync,
  getRegisterCommunityInstructionAsync,
  getVerifyCommunityInstructionAsync,
  ReadinessBand,
  ReadinessStatus,
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
  /** Null for a transaction just sent: the batch confirms them together. */
  slot: number | null;
  account: Address;
  commitment: Uint8Array;
  recovered: boolean;
}

/** A failure retrying cannot fix. */
class PermanentError extends Error {}

const BATCH = 8;
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

/**
 * Signs and sends; does not wait. Jobs in one batch never depend on each
 * other (a dependent job is only claimable once its dependency confirmed), so
 * a whole batch can be sent and then confirmed in one status query.
 */
async function send(instruction: Instruction): Promise<{ signature: string; slot: null }> {
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
  return { signature, slot: null };
}

type Confirmation = { slot: number } | { error: string };

/**
 * Waits for a set of signatures together. Polls rather than subscribes: a
 * websocket is one more thing to fail inside a short-lived function, and
 * devnet confirms in a few seconds. Missing from the map: not confirmed in time.
 */
async function confirmAll(signatures: string[]): Promise<Map<string, Confirmation>> {
  const settled = new Map<string, Confirmation>();
  if (!signatures.length) return settled;
  await sleep(1_000);
  for (let i = 0; i < 30 && settled.size < signatures.length; i++) {
    const waiting = signatures.filter((s) => !settled.has(s));
    const { value } = await rpc.getSignatureStatuses(waiting as never).send();
    value.forEach((status, k) => {
      if (status?.err) settled.set(waiting[k], { error: `transaction failed: ${JSON.stringify(status.err)}` });
      else if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        settled.set(waiting[k], { slot: Number(status.slot) });
      }
    });
    if (settled.size < signatures.length) await sleep(1_500);
  }
  return settled;
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

/** The RPC is rate-limiting us: stop this run and let the next one continue. */
const isRateLimited = (message: string) => message.includes("429");

/** "2026-09" → 202609, as the program keys a month. */
const periodNumber = (period: unknown) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period));
  if (!match) throw new PermanentError(`invalid period in payload: ${period}`);
  return Number(match[1]) * 100 + Number(match[2]);
};

/** "readiness-v0.1.0" → 100 (major * 10000 + minor * 100 + patch). */
const modelVersionNumber = (version: unknown) => {
  const match = /v(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) throw new PermanentError(`invalid model version in payload: ${version}`);
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
};

const STATUS = {
  CREDIT_READY: ReadinessStatus.CreditReady,
  NEEDS_MORE_DATA: ReadinessStatus.NeedsMoreData,
  NEEDS_PREPARATION: ReadinessStatus.NeedsPreparation,
  MANUAL_REVIEW: ReadinessStatus.ManualReview,
} as const;
const BAND = { LOW: ReadinessBand.Low, MEDIUM: ReadinessBand.Medium, HIGH: ReadinessBand.High } as const;

const mismatch = (what: string, account: Address) =>
  new PermanentError(`${what} on chain differs from the database (account ${account})`);

// -------------------------------------------------------------------- jobs

async function anchor(job: Job): Promise<Proof> {
  if (!job.payload) throw new PermanentError("no payload: the record is missing or not in an anchorable state");

  const commitment = await commit(ANCHOR_DOMAINS[job.kind], job.payload);
  const signer = await getOperator();

  // Check-ins and readiness hang off her borrower account.
  if (job.kind === "checkin" || job.kind === "readiness") {
    if (!job.borrower_ref) throw new PermanentError("no borrower ref for this job");
    const [borrower] = await findBorrowerPda({ borrowerRefHash: await hashBorrowerRef(fromHex(job.borrower_ref)) });

    if (job.kind === "checkin") {
      const period = periodNumber(job.payload.period);
      const [account] = await findCheckinPda({ borrower, period });
      const existing = await fetchMaybeCheckinCommitment(rpc, account);
      if (existing.exists) {
        if (!sameCommitment(new Uint8Array(existing.data.commitment), commitment)) {
          throw mismatch("check-in commitment", account);
        }
        return { ...(await recoverSignature(account, "first")), account, commitment, recovered: true };
      }
      const ix = await getAnchorCheckinInstructionAsync({ operator: signer, borrower, period, commitment });
      return { ...(await send(ix)), account, commitment, recovered: false };
    }

    const assessmentNo = Number(job.payload.assessment_no);
    const status = STATUS[job.payload.status as keyof typeof STATUS];
    const band = BAND[job.payload.band as keyof typeof BAND];
    if (!Number.isInteger(assessmentNo) || status === undefined || band === undefined) {
      throw new PermanentError("readiness payload lacks a valid number, status or band");
    }
    const [account] = await findAttestationPda({ borrower, assessmentNo });
    const existing = await fetchMaybeReadinessAttestation(rpc, account);
    if (existing.exists) {
      if (!sameCommitment(new Uint8Array(existing.data.commitment), commitment)) {
        throw mismatch("readiness commitment", account);
      }
      return { ...(await recoverSignature(account, "first")), account, commitment, recovered: true };
    }
    const ix = await getAttestReadinessInstructionAsync({
      operator: signer,
      borrower,
      assessmentNo,
      status,
      band,
      modelVersion: modelVersionNumber(job.payload.model_version),
      commitment,
    });
    return { ...(await send(ix)), account, commitment, recovered: false };
  }

  if (!job.community_ref) throw new PermanentError("no community ref for this job");
  const communityRef = fromHex(job.community_ref);
  const [community] = await findCommunityPda({ communityRef });

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

type Result = {
  id: number;
  kind: AnchorKind;
  outcome: "confirmed" | "recovered" | "retry" | "failed";
  signature?: string;
  error?: string;
  rateLimited?: boolean;
};

async function failJob(job: Job, err: unknown): Promise<Result> {
  const message = err instanceof Error ? err.message : String(err);
  const retryable = !(err instanceof PermanentError);
  await db.rpc("fail_anchor_job", { p_id: job.id, p_error: message, p_retryable: retryable });
  return { id: job.id, kind: job.kind, outcome: retryable ? "retry" : "failed", error: message, rateLimited: isRateLimited(message) };
}

async function completeJob(job: Job, proof: Proof & { slot: number }): Promise<Result> {
  try {
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
    // The chain has it; the next attempt finds the account and recovers.
    return failJob(job, err);
  }
}

/**
 * One claimed batch: prepare and send each job in turn, then confirm every
 * sent transaction together, then record. Returns true if the RPC started
 * rate-limiting, having handed back the jobs it did not reach.
 */
async function runBatch(batch: Job[], results: Result[]): Promise<boolean> {
  const prepared: { job: Job; proof: Proof }[] = [];
  for (const [i, job] of batch.entries()) {
    try {
      prepared.push({ job, proof: await anchor(job) });
    } catch (err) {
      const result = await failJob(job, err);
      results.push(result);
      if (result.rateLimited) {
        const untouched = batch.slice(i + 1).map((j) => j.id);
        if (untouched.length) await db.rpc("release_anchor_jobs", { p_ids: untouched });
        // What was already sent still gets confirmed and recorded below.
        await settle(prepared, results);
        return true;
      }
    }
  }
  await settle(prepared, results);
  return false;
}

async function settle(prepared: { job: Job; proof: Proof }[], results: Result[]) {
  const sent = prepared.filter((p) => p.proof.slot === null).map((p) => p.proof.signature);
  let confirmations: Map<string, Confirmation>;
  try {
    confirmations = await confirmAll(sent);
  } catch (err) {
    confirmations = new Map(); // treated as unconfirmed: retried, then recovered
    for (const p of prepared.filter((p) => p.proof.slot === null)) results.push(await failJob(p.job, err));
    prepared = prepared.filter((p) => p.proof.slot !== null);
  }
  for (const { job, proof } of prepared) {
    if (proof.slot !== null) {
      results.push(await completeJob(job, { ...proof, slot: proof.slot }));
      continue;
    }
    const c = confirmations.get(proof.signature);
    if (!c) results.push(await failJob(job, new Error(`not confirmed in time: ${proof.signature}`)));
    else if ("error" in c) results.push(await failJob(job, new Error(c.error)));
    else results.push(await completeJob(job, { ...proof, slot: c.slot }));
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }

  // One run at a time (start_anchor_run is a lease): parallel runs multiply
  // the requests to the devnet RPC and draw 429s.
  const { data: acquired, error: leaseError } = await db.rpc("start_anchor_run", {
    p_lease_seconds: Math.ceil(TIME_BUDGET_MS / 1000) + 50,
  });
  if (leaseError) return Response.json({ error: `lease failed: ${leaseError.message}` }, { status: 500 });
  if (!acquired) return Response.json({ skipped: "another run is in progress" });

  const started = Date.now();
  const results: Result[] = [];
  try {
    // Several rounds per call, so a registration and the verification waiting
    // on it can both land in one run instead of one per cron tick.
    rounds: while (Date.now() - started < TIME_BUDGET_MS) {
      const { data: jobs, error } = await db.rpc("claim_anchor_jobs", { p_limit: BATCH });
      if (error) {
        return Response.json({ error: `claim failed: ${error.message}`, results }, { status: 500 });
      }
      if (!jobs?.length) break;
      if (await runBatch(jobs as Job[], results)) break rounds;
    }
  } finally {
    await db.rpc("finish_anchor_run");
  }

  return Response.json({ processed: results.length, results });
});
