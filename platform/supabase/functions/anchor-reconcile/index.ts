// anchor-reconcile — checks confirmed proofs again, against the chain and the database.
//
// Called every minute by pg_cron (private.dispatch_reconcile) while any proof
// is due a check — never checked, or not for a day — with the same shared
// secret as anchor-submit. For each, it recomputes the commitment from the
// record as it stands now and compares it with the commitment recorded at
// anchoring and with the account on chain:
//
//   verified  all three agree
//   missing   no such account, or one the program does not own
//   mismatch  the record changed after it was proven, or the chain holds
//             something else
//
// A status change is proven in the loan's account only until the next one;
// an earlier change is checked in the transaction that made it.
//
// Read-only on chain: no key. Secrets: ANCHOR_CRON_SECRET, optional
// SOLANA_RPC_URL; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import {
  type Address,
  createSolanaRpc,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type Signature,
} from "@solana/kit";
import {
  ANCHOR_DOMAINS,
  type AnchorKind,
  type CanonicalObject,
  commit,
  fromHex,
  sameCommitment,
} from "../_shared/audit-commitments/index.ts";
import {
  EMPOWERFI_AUDIT_PROGRAM_ADDRESS,
  EmpowerfiAuditAccount,
  getBorrowerAuditDecoder,
  getCheckinCommitmentDecoder,
  getCommunityAuditDecoder,
  getEligibilityAttestationDecoder,
  getLoanAccountDecoder,
  getOpportunityCommitmentDecoder,
  getOutcomeCommitmentDecoder,
  getPaymentCommitmentDecoder,
  getReadinessAttestationDecoder,
  getTransitionLoanInstructionDataDecoder,
  identifyEmpowerfiAuditAccount,
} from "../_shared/audit-client/index.ts";

interface Row {
  id: number;
  kind: AnchorKind;
  entity_id: string;
  commitment: string;
  account_address: string;
  signature: string;
  payload: CanonicalObject | null;
}

type Outcome = { id: number; result: "verified" | "missing" | "mismatch"; note: string | null };

const BATCH = 200;

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");

function secretMatches(given: string | null, expected: string): boolean {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// The account type each proof lives in, and the commitment field it fills.
const HOLDER: Record<AnchorKind, { type: EmpowerfiAuditAccount; read: (data: Uint8Array) => Uint8Array }> = {
  community: { type: EmpowerfiAuditAccount.CommunityAudit, read: (d) => new Uint8Array(getCommunityAuditDecoder().decode(d).commitment) },
  community_verification: {
    type: EmpowerfiAuditAccount.CommunityAudit,
    read: (d) => new Uint8Array(getCommunityAuditDecoder().decode(d).verificationCommitment),
  },
  enrollment: { type: EmpowerfiAuditAccount.BorrowerAudit, read: (d) => new Uint8Array(getBorrowerAuditDecoder().decode(d).enrollmentCommitment) },
  checkin: { type: EmpowerfiAuditAccount.CheckinCommitment, read: (d) => new Uint8Array(getCheckinCommitmentDecoder().decode(d).commitment) },
  readiness: { type: EmpowerfiAuditAccount.ReadinessAttestation, read: (d) => new Uint8Array(getReadinessAttestationDecoder().decode(d).commitment) },
  eligibility: { type: EmpowerfiAuditAccount.EligibilityAttestation, read: (d) => new Uint8Array(getEligibilityAttestationDecoder().decode(d).commitment) },
  opportunity: { type: EmpowerfiAuditAccount.OpportunityCommitment, read: (d) => new Uint8Array(getOpportunityCommitmentDecoder().decode(d).commitment) },
  loan: { type: EmpowerfiAuditAccount.LoanAccount, read: (d) => new Uint8Array(getLoanAccountDecoder().decode(d).termsCommitment) },
  loan_transition: { type: EmpowerfiAuditAccount.LoanAccount, read: (d) => new Uint8Array(getLoanAccountDecoder().decode(d).lastTransitionCommitment) },
  payment: { type: EmpowerfiAuditAccount.PaymentCommitment, read: (d) => new Uint8Array(getPaymentCommitmentDecoder().decode(d).commitment) },
  outcome: { type: EmpowerfiAuditAccount.OutcomeCommitment, read: (d) => new Uint8Array(getOutcomeCommitmentDecoder().decode(d).commitment) },
};

/** The commitment a transition_loan transaction carried, if it succeeded. */
async function transitionInTransaction(signature: string): Promise<Uint8Array | null> {
  const tx = await rpc.getTransaction(signature as Signature, { encoding: "base64", maxSupportedTransactionVersion: 0 }).send();
  if (!tx || tx.meta?.err) return null;
  const decoded = getTransactionDecoder().decode(getBase64Encoder().encode(tx.transaction[0]));
  const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
  if (!("instructions" in message)) return null;
  const ix = message.instructions.find((i) => message.staticAccounts[i.programAddressIndex] === EMPOWERFI_AUDIT_PROGRAM_ADDRESS);
  return ix?.data ? new Uint8Array(getTransitionLoanInstructionDataDecoder().decode(ix.data).transitionCommitment) : null;
}

async function check(row: Row, account: { owner: string; data: Uint8Array } | null): Promise<Outcome> {
  const out = (result: Outcome["result"], note: string | null = null): Outcome => ({ id: row.id, result, note });
  const recorded = fromHex(row.commitment);

  if (!row.payload) return out("mismatch", "the record is gone from the database");
  if (!sameCommitment(await commit(ANCHOR_DOMAINS[row.kind], row.payload), recorded)) {
    return out("mismatch", "the record changed after it was proven");
  }
  if (!account) return out("missing", `no account at ${row.account_address}`);
  if (account.owner !== EMPOWERFI_AUDIT_PROGRAM_ADDRESS) return out("missing", `account ${row.account_address} is not the program's`);

  const holder = HOLDER[row.kind];
  let type: EmpowerfiAuditAccount;
  try {
    type = identifyEmpowerfiAuditAccount(account.data);
  } catch {
    return out("mismatch", "the account is not one the program writes");
  }
  if (type !== holder.type) return out("mismatch", `the account holds a ${EmpowerfiAuditAccount[type]}`);
  if (sameCommitment(holder.read(account.data), recorded)) return out("verified");

  if (row.kind === "loan_transition") {
    const carried = await transitionInTransaction(row.signature);
    if (carried && sameCommitment(carried, recorded)) return out("verified", "earlier change, checked in its transaction");
    return out("mismatch", "neither the loan account nor the transaction holds this change");
  }
  return out("mismatch", "the chain holds a different commitment");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data, error } = await db.rpc("claim_reconcile_batch", { p_limit: BATCH });
  if (error) return Response.json({ error: `claim failed: ${error.message}` }, { status: 500 });
  const rows = (data ?? []) as Row[];
  if (!rows.length) return Response.json({ checked: 0 });

  const outcomes: Outcome[] = [];
  let stopped: string | null = null;
  try {
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { value } = await rpc
        .getMultipleAccounts(chunk.map((r) => r.account_address as Address), { encoding: "base64", commitment: "confirmed" })
        .send();
      for (const [k, row] of chunk.entries()) {
        const found = value[k];
        const account = found ? { owner: found.owner, data: new Uint8Array(getBase64Encoder().encode(found.data[0])) } : null;
        outcomes.push(await check(row, account));
      }
    }
  } catch (err) {
    // A rate limit or an RPC outage: record what was checked; the rest stays due.
    stopped = err instanceof Error ? err.message : String(err);
  }

  if (outcomes.length) {
    const { error: recordError } = await db.rpc("record_reconciliation", { p_results: outcomes });
    if (recordError) return Response.json({ error: `recording failed: ${recordError.message}` }, { status: 500 });
  }
  const tally = outcomes.reduce<Record<string, number>>((t, o) => ({ ...t, [o.result]: (t[o.result] ?? 0) + 1 }), {});
  return Response.json({
    checked: outcomes.length,
    ...tally,
    problems: outcomes.filter((o) => o.result !== "verified").slice(0, 20),
    ...(stopped ? { stopped } : {}),
  });
});
