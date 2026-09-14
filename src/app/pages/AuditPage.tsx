import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  address,
  createSolanaRpc,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type Address,
  type Signature,
} from "@solana/kit";
import { ArrowLeft, CheckCircle2, CircleDashed, ExternalLink, Loader2, ShieldAlert, XCircle } from "lucide-react";
import {
  ANCHOR_DOMAINS,
  canonicalize,
  commit,
  fromHex,
  hashBorrowerRef,
  sameCommitment,
  toHex,
  type AnchorKind,
  type CanonicalObject,
} from "@empowerfi/audit-commitments";
import {
  EMPOWERFI_AUDIT_PROGRAM_ADDRESS,
  fetchMaybeBorrowerAudit,
  fetchMaybeCheckinCommitment,
  fetchMaybeCommunityAudit,
  fetchMaybeEligibilityAttestation,
  fetchMaybeLoanAccount,
  fetchMaybeOpportunityCommitment,
  fetchMaybeOutcomeCommitment,
  fetchMaybePaymentCommitment,
  fetchMaybeReadinessAttestation,
  findAttestationPda,
  findBorrowerPda,
  findCheckinPda,
  findCommunityPda,
  findEligibilityPda,
  findLoanPda,
  findOpportunityPda,
  findOutcomePda,
  findPaymentPda,
  EligibilityDecision,
  getTransitionLoanInstructionDataDecoder,
  Grade,
  LoanStatus,
  ReadinessBand,
  ReadinessStatus,
} from "@empowerfi/audit-client";
import { assessEligibility, type EligibilityInput } from "@empowerfi/eligibility-engine";
import { evaluateReadiness, type ReadinessFeatures } from "@empowerfi/readiness-engine";
import { describeError } from "../lib/errors";
import { explorerAddress, explorerTx, platform } from "../lib/platform";

// The recompute-a-proof screen (PLAN_HACKATHON.md §G.4). Nothing here trusts
// the server's verdict: the browser rebuilds the commitment from the record,
// reads the account straight from devnet, and compares the two itself.

const rpc = createSolanaRpc(
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ?? "https://api.devnet.solana.com",
);

const KIND_TITLE: Record<AnchorKind, string> = {
  community: "Community registration",
  community_verification: "Community verification",
  enrollment: "Borrower enrollment",
  checkin: "Monthly check-in",
  readiness: "Readiness assessment",
  eligibility: "Eligibility assessment",
  opportunity: "Qualified credit opportunity",
  loan: "Loan terms",
  loan_transition: "Loan status change",
  payment: "Instalment paid",
  outcome: "Productive outcome",
};

const ELIGIBILITY_FIELDS = [
  "model_version", "decision", "requested_amount_cents", "proposed_amount_cents", "term_months", "instalment_cents",
  "max_instalment_cents", "affordability_bps", "suggested_min_cents", "suggested_max_cents", "risk_band", "risk_points",
  "confidence", "reason_codes",
] as const;
const SNAKE_TO_PASCAL = (v: unknown) =>
  String(v).toLowerCase().replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase());

/**
 * The commitment a transition_loan transaction actually carried, read from the
 * transaction itself: the loan account only keeps its latest transition, so
 * older ones are checked against the instruction that made them.
 */
async function transitionInTransaction(signature: string) {
  const tx = await rpc
    .getTransaction(signature as Signature, { encoding: "base64", maxSupportedTransactionVersion: 0 })
    .send();
  if (!tx) return null;
  const decoded = getTransactionDecoder().decode(getBase64Encoder().encode(tx.transaction[0]));
  const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
  // Our transactions are version 0; a message in another format is not ours to parse.
  if (!("instructions" in message)) return null;
  const ix = message.instructions.find((i) => message.staticAccounts[i.programAddressIndex] === EMPOWERFI_AUDIT_PROGRAM_ADDRESS);
  return ix?.data ? getTransitionLoanInstructionDataDecoder().decode(ix.data) : null;
}

const periodNumber = (period: unknown) => Number(String(period).replace("-", ""));

// The fields an assessment row stores from the engine's result.
const RESULT_FIELDS = ["model_version", "status", "band", "score", "components", "missing_requirements", "reason_codes"] as const;
const sameJson = (a: unknown, b: unknown) => canonicalize(a as CanonicalObject) === canonicalize(b as CanonicalObject);

interface AuditRecord {
  anchor: {
    kind: AnchorKind;
    entity_id: string;
    status: string;
    commitment: string | null;
    account_address: string | null;
    signature: string | null;
    slot: number | null;
    program_id: string;
    reconcile: "unchecked" | "verified" | "missing" | "mismatch";
    reconciled_at: string | null;
    reconcile_note: string | null;
  };
  payload: CanonicalObject | null;
  /** The community's chain ref: what every account address is derived from. */
  community_ref: string | null;
  /** Auditors and admins only. */
  borrower_ref: string | null;
}

interface Check {
  label: string;
  /** null: could not be checked by this viewer (for instance, no borrower ref). */
  ok: boolean | null;
  detail?: string;
}

type Verdict = "VERIFIED" | "MISMATCH" | "MISSING" | "PENDING";

async function audit(kind: AnchorKind, entityId: string) {
  const { data, error } = await platform.rpc("audit_record", { p_kind: kind, p_entity_id: entityId });
  if (error) throw error;
  const record = data as unknown as AuditRecord;
  const { anchor, payload } = record;

  if (anchor.status !== "confirmed" || !anchor.account_address || !anchor.commitment) {
    return { record, verdict: "PENDING" as Verdict, checks: [] as Check[], recomputed: null, onChain: null, canonical: null };
  }
  if (!payload) throw new Error("The record behind this proof no longer exists.");

  const canonical = canonicalize(payload);
  const recomputed = await commit(ANCHOR_DOMAINS[kind], payload);
  const recorded = fromHex(anchor.commitment);
  const account = address(anchor.account_address);
  const checks: Check[] = [];

  // Where the account should be, derived independently of what was recorded.
  const [community] = record.community_ref
    ? await findCommunityPda({ communityRef: fromHex(record.community_ref) })
    : [null];
  let expected: Address | null = null;
  let onChain: Uint8Array | null = null;
  let owner: string | null = null;

  // The borrower account check-ins and assessments hang off, when this viewer
  // may know which one it is.
  const borrower = record.borrower_ref
    ? (await findBorrowerPda({ borrowerRefHash: await hashBorrowerRef(fromHex(record.borrower_ref)) }))[0]
    : null;

  const p = payload;
  if (kind === "eligibility") {
    const found = await fetchMaybeEligibilityAttestation(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
      checks.push({
        label: "Decision, risk and confidence on chain match the record",
        ok:
          EligibilityDecision[found.data.decision] === SNAKE_TO_PASCAL(p.decision) &&
          Grade[found.data.riskBand] === SNAKE_TO_PASCAL(p.risk_band) &&
          Grade[found.data.confidence] === SNAKE_TO_PASCAL(p.confidence),
      });
      if (borrower) {
        [expected] = await findEligibilityPda({ borrower, eligibilityNo: Number(p.eligibility_no) });
        const [readiness] = await findAttestationPda({ borrower, assessmentNo: Number(p.readiness_assessment_no) });
        checks.push({ label: "Relies on her own readiness attestation", ok: found.data.readiness === readiness });
      }
    }
    const rerun = assessEligibility(p.inputs as unknown as EligibilityInput);
    checks.push({
      label: `Re-running ${rerun.model_version} on the stored inputs gives the same result`,
      ok: ELIGIBILITY_FIELDS.every((f) => sameJson({ v: rerun[f] }, { v: p[f] })),
    });
  } else if (kind === "opportunity") {
    const found = await fetchMaybeOpportunityCommitment(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
      if (borrower) {
        [expected] = await findOpportunityPda({ borrower, opportunityNo: Number(p.opportunity_no) });
        const [eligibility] = await findEligibilityPda({ borrower, eligibilityNo: Number(p.eligibility_no) });
        checks.push({ label: "Comes from her eligibility attestation", ok: found.data.eligibility === eligibility });
      }
    }
  } else if (kind === "loan" || kind === "loan_transition" || kind === "payment" || kind === "outcome") {
    const opportunity = borrower ? (await findOpportunityPda({ borrower, opportunityNo: Number(p.opportunity_no) }))[0] : null;
    const loanAddress = opportunity ? (await findLoanPda({ opportunity }))[0] : null;
    if (kind === "outcome") {
      const found = await fetchMaybeOutcomeCommitment(rpc, account);
      if (found.exists) {
        onChain = new Uint8Array(found.data.commitment);
        owner = found.programAddress;
        checks.push({ label: "The measurement on chain is the one on record", ok: found.data.outcomeNo === Number(p.outcome_no) });
        if (loanAddress) {
          [expected] = await findOutcomePda({ loan: loanAddress, outcomeNo: Number(p.outcome_no) });
          checks.push({ label: "Measures her loan", ok: found.data.loan === loanAddress });
        }
      }
      // The arithmetic, redone here from the figures on record.
      const incremental = (Number(p.avg_net_after_cents) - Number(p.avg_net_before_cents)) * Number(p.months_after);
      checks.push({
        label: "Incremental profit is the change in monthly result times the months after the loan",
        ok: incremental === Number(p.incremental_profit_cents),
      });
      checks.push({
        label: "EVC is the incremental profit less the cost of credit",
        ok: Number(p.evc_cents) === Number(p.incremental_profit_cents) - Number(p.cost_of_credit_cents),
      });
    } else if (kind === "payment") {
      const found = await fetchMaybePaymentCommitment(rpc, account);
      if (found.exists) {
        onChain = new Uint8Array(found.data.commitment);
        owner = found.programAddress;
        checks.push({ label: "The instalment on chain is the one on record", ok: found.data.instalmentNo === Number(p.instalment_no) });
        if (loanAddress) {
          [expected] = await findPaymentPda({ loan: loanAddress, instalmentNo: Number(p.instalment_no) });
          checks.push({ label: "Belongs to her loan", ok: found.data.loan === loanAddress });
        }
      }
    } else {
      const found = await fetchMaybeLoanAccount(rpc, account);
      if (found.exists) {
        owner = found.programAddress;
        if (loanAddress) expected = loanAddress;
        if (kind === "loan") {
          onChain = new Uint8Array(found.data.termsCommitment);
          if (opportunity) checks.push({ label: "Opened from her opportunity", ok: found.data.opportunity === opportunity });
        } else {
          // Older transitions are no longer the loan's latest: read the
          // commitment from the transaction that made the change.
          const carried = record.anchor.signature ? await transitionInTransaction(record.anchor.signature) : null;
          onChain = carried ? new Uint8Array(carried.transitionCommitment) : null;
          checks.push({
            label: `The transaction moved the loan to ${String(p.to_status).toLowerCase().replace("_", " ")}`,
            ok: carried !== null && LoanStatus[carried.to] === SNAKE_TO_PASCAL(p.to_status),
          });
          checks.push({
            label: "The loan on chain has moved at least this far",
            ok: found.data.transitions >= 1,
            detail: `now ${LoanStatus[found.data.status]}, after ${found.data.transitions} changes`,
          });
        }
      }
    }
  } else if (kind === "checkin") {
    const found = await fetchMaybeCheckinCommitment(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
      checks.push({ label: "The month on chain is the month on record", ok: found.data.period === periodNumber(payload.period) });
      if (borrower) {
        [expected] = await findCheckinPda({ borrower, period: periodNumber(payload.period) });
        checks.push({ label: "Belongs to her borrower account", ok: found.data.borrower === borrower });
      }
    }
  } else if (kind === "readiness") {
    const found = await fetchMaybeReadinessAttestation(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
      checks.push({
        label: "Status and band on chain match the record",
        ok:
          ReadinessStatus[found.data.status] === { CREDIT_READY: "CreditReady", NEEDS_MORE_DATA: "NeedsMoreData",
            NEEDS_PREPARATION: "NeedsPreparation", MANUAL_REVIEW: "ManualReview" }[String(payload.status)] &&
          ReadinessBand[found.data.band] === { LOW: "Low", MEDIUM: "Medium", HIGH: "High" }[String(payload.band)],
      });
      if (borrower) {
        [expected] = await findAttestationPda({ borrower, assessmentNo: Number(payload.assessment_no) });
        checks.push({ label: "Belongs to her borrower account", ok: found.data.borrower === borrower });
      }
    }
    // Deterministic and versioned, checked rather than claimed: run the same
    // engine, here, on the features stored with the assessment.
    const rerun = evaluateReadiness(payload.features as unknown as ReadinessFeatures);
    checks.push({
      label: `Re-running ${rerun.model_version} on the stored features gives the same result`,
      ok: RESULT_FIELDS.every((f) => sameJson({ v: rerun[f] }, { v: payload[f] })),
    });
  } else if (kind === "enrollment") {
    const found = await fetchMaybeBorrowerAudit(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.enrollmentCommitment);
      owner = found.programAddress;
      checks.push({
        label: "Registered through the community she joined",
        ok: community !== null && found.data.community === community,
      });
      if (record.borrower_ref) {
        const refHash = await hashBorrowerRef(fromHex(record.borrower_ref));
        [expected] = await findBorrowerPda({ borrowerRefHash: refHash });
        checks.push({
          label: "Borrower ref hashes to the account's key",
          ok: sameCommitment(refHash, new Uint8Array(found.data.borrowerRefHash)),
        });
      }
    }
  } else {
    const found = await fetchMaybeCommunityAudit(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(kind === "community" ? found.data.commitment : found.data.verificationCommitment);
      owner = found.programAddress;
      expected = community;
    }
  }

  if (!onChain) {
    return { record, verdict: "MISSING" as Verdict, checks, recomputed, onChain: null, canonical };
  }

  checks.unshift(
    { label: "Recomputed commitment matches the one recorded", ok: sameCommitment(recomputed, recorded) },
    { label: "Recomputed commitment matches the account on-chain", ok: sameCommitment(recomputed, onChain) },
    { label: "Account is owned by the EmpowerFI audit program", ok: owner === EMPOWERFI_AUDIT_PROGRAM_ADDRESS },
  );
  checks.push(
    expected
      ? { label: "Account address matches its derivation (PDA)", ok: expected === account }
      : {
          label: "Account address matches its derivation (PDA)",
          ok: null,
          detail: ["community", "community_verification"].includes(kind) ? "community ref unavailable" : "needs the borrower ref — auditors and admins only",
        },
  );

  const verdict: Verdict = checks.some((c) => c.ok === false) ? "MISMATCH" : "VERIFIED";
  return { record, verdict, checks, recomputed, onChain, canonical };
}

const VERDICT_STYLE: Record<Verdict, { className: string; icon: typeof CheckCircle2; text: string }> = {
  VERIFIED: { className: "border-emerald-300 bg-emerald-50 text-emerald-900", icon: CheckCircle2, text: "The record in the database is the one proven on Solana." },
  MISMATCH: { className: "border-red-300 bg-red-50 text-red-900", icon: XCircle, text: "The record no longer matches its proof. It changed after it was anchored." },
  MISSING: { className: "border-red-300 bg-red-50 text-red-900", icon: ShieldAlert, text: "The account recorded for this proof does not exist on-chain." },
  PENDING: { className: "border-amber-300 bg-amber-50 text-amber-900", icon: CircleDashed, text: "This fact has not been anchored yet." },
};

function Hash({ label, bytes }: { label: string; bytes: Uint8Array | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="break-all font-mono text-xs text-foreground">{bytes ? toHex(bytes) : "—"}</p>
    </div>
  );
}

export default function AuditPage() {
  const { kind = "", entityId = "" } = useParams();
  const valid = kind in ANCHOR_DOMAINS;

  const result = useQuery({
    queryKey: ["platform", "audit", kind, entityId],
    enabled: valid,
    queryFn: () => audit(kind as AnchorKind, entityId),
    retry: false,
  });

  if (!valid) return <p className="text-muted-foreground">Unknown kind of proof.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Audit</p>
        <h1 className="font-heading text-3xl font-bold text-foreground">{KIND_TITLE[kind as AnchorKind]}</h1>
        <p className="text-muted-foreground">
          Recomputed in your browser from the database record, and compared with the account on Solana Devnet.
        </p>
      </div>

      {result.isLoading && (
        <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={16} /> Recomputing and reading devnet…</p>
      )}
      {result.error && <p className="text-destructive">{describeError(result.error)}</p>}

      {result.data && (() => {
        const { record, verdict, checks, recomputed, onChain, canonical } = result.data;
        const style = VERDICT_STYLE[verdict];
        const Icon = style.icon;
        return (
          <>
            <div className={`flex items-start gap-3 rounded-2xl border p-5 ${style.className}`} role="status">
              <Icon className="mt-0.5 shrink-0" size={22} />
              <div>
                <p className="font-heading text-xl font-bold tracking-wide">{verdict}</p>
                <p className="text-sm">{style.text}</p>
              </div>
            </div>

            {checks.length > 0 && (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                    <span className="text-foreground">
                      {c.label}
                      {c.detail && <span className="block text-xs text-muted-foreground">{c.detail}</span>}
                    </span>
                    {c.ok === true && <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-label="passes" />}
                    {c.ok === false && <XCircle size={18} className="shrink-0 text-red-600" aria-label="fails" />}
                    {c.ok === null && <CircleDashed size={18} className="shrink-0 text-muted-foreground" aria-label="not checked" />}
                  </li>
                ))}
              </ul>
            )}

            <section className="space-y-4 rounded-2xl p-6 glass glow-border">
              <Hash label="Recomputed here" bytes={recomputed} />
              <Hash label="Recorded in the database" bytes={record.anchor.commitment ? fromHex(record.anchor.commitment) : null} />
              <Hash label="On-chain" bytes={onChain} />
              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
                {record.anchor.signature && (
                  <a href={explorerTx(record.anchor.signature)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:text-foreground">
                    Transaction · slot {record.anchor.slot} <ExternalLink size={12} />
                  </a>
                )}
                {record.anchor.account_address && (
                  <a href={explorerAddress(record.anchor.account_address)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:text-foreground">
                    Account <ExternalLink size={12} />
                  </a>
                )}
              </div>
              {record.anchor.reconciled_at && (
                <p className={`text-xs ${record.anchor.reconcile === "verified" ? "text-muted-foreground" : "text-red-700"}`}>
                  Also re-checked by EmpowerFI's reconciliation job on {new Date(record.anchor.reconciled_at).toLocaleString("en-GB")}:{" "}
                  {record.anchor.reconcile}{record.anchor.reconcile_note ? ` — ${record.anchor.reconcile_note}` : ""}.
                </p>
              )}
            </section>

            {canonical && (
              <section className="space-y-2">
                <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  What was committed · {ANCHOR_DOMAINS[kind as AnchorKind]}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border bg-background/60 p-4">
                  <pre className="text-xs text-foreground">{JSON.stringify(JSON.parse(canonical), null, 2)}</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  SHA-256 of the domain tag, a zero byte and this record in canonical JSON. No personal data leaves the
                  database; the chain holds only the hash.
                </p>
              </section>
            )}
          </>
        );
      })()}

      <Link to="/app/community" className="text-sm text-accent">Communities</Link>
    </div>
  );
}
