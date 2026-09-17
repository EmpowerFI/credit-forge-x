import {
  address,
  createSolanaRpc,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type Address,
  type Signature,
} from "@solana/kit";
import {
  ANCHOR_DOMAINS,
  canonicalize,
  commit,
  fromHex,
  hashAllocationRef,
  hashBorrowerRef,
  sameCommitment,
  type AnchorKind,
  type CanonicalObject,
} from "@empowerfi/audit-commitments";
import {
  EMPOWERFI_AUDIT_PROGRAM_ADDRESS,
  fetchMaybeAllocationCommitment,
  fetchMaybeBorrowerAudit,
  fetchMaybeCheckinCommitment,
  fetchMaybeCommunityAudit,
  fetchMaybeConsentCommitment,
  fetchMaybeEligibilityAttestation,
  fetchMaybeLoanAccount,
  fetchMaybeOpportunityCommitment,
  fetchMaybeOutcomeCommitment,
  fetchMaybePaymentCommitment,
  fetchMaybeReadinessAttestation,
  findAttestationPda,
  findAllocationPda,
  findBorrowerPda,
  findCheckinPda,
  findCommunityPda,
  findConsentPda,
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
import { localized, tr } from "../i18n";
import { ELIGIBILITY_RESULT_FIELDS, READINESS_RESULT_FIELDS } from "./audit";
import { LOAN_LABEL, type LoanStatus as LoanStatusCode } from "./credit";
import { platform } from "./platform";
import { depositToVault, usdc } from "./solana";

// Recomputing a proof (PLAN_HACKATHON.md §G.4), for the audit page and the proof
// drawer beside every critical event. Nothing here trusts
// the server's verdict: the browser rebuilds the commitment from the record,
// reads the account straight from devnet, and compares the two itself.

const rpc = createSolanaRpc(
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ?? "https://api.devnet.solana.com",
);

export const KIND_TITLE: Record<AnchorKind, string> = localized({
  community: { en: "Community registration", pt: "Cadastro da comunidade" },
  community_verification: { en: "Community verification", pt: "Verificação da comunidade" },
  enrollment: { en: "Borrower enrollment", pt: "Inscrição da empreendedora" },
  checkin: { en: "Monthly check-in", pt: "Check-in mensal" },
  readiness: { en: "Readiness assessment", pt: "Avaliação de prontidão" },
  eligibility: { en: "Eligibility assessment", pt: "Avaliação de elegibilidade" },
  opportunity: { en: "Qualified credit opportunity", pt: "Oportunidade de crédito qualificada" },
  loan: { en: "Loan terms", pt: "Condições do empréstimo" },
  loan_transition: { en: "Loan status change", pt: "Mudança de status do empréstimo" },
  payment: { en: "Instalment paid", pt: "Parcela paga" },
  outcome: { en: "Productive outcome", pt: "Resultado produtivo" },
  allocation: { en: "Capital allocation", pt: "Alocação de capital" },
  consent: { en: "Consent record", pt: "Registro de consentimento" },
});

const ELIGIBILITY_FIELDS = ELIGIBILITY_RESULT_FIELDS;
const SNAKE_TO_PASCAL = (v: unknown) =>
  String(v).toLowerCase().replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase());
const PASCAL_TO_SNAKE = (v: string) => v.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
/** A loan status code, in words, in the current language. */
const loanStatusWords = (code: string) => LOAN_LABEL[code as LoanStatusCode]?.toLowerCase() ?? code.toLowerCase().replace("_", " ");

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

const RESULT_FIELDS = READINESS_RESULT_FIELDS;
const sameJson = (a: unknown, b: unknown) => canonicalize(a as CanonicalObject) === canonicalize(b as CanonicalObject);

export interface AuditRecord {
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
    confirmed_at: string | null;
  };
  payload: CanonicalObject | null;
  /** The community's chain ref: what every account address is derived from. */
  community_ref: string | null;
  /** Auditors and admins only. */
  borrower_ref: string | null;
}

export interface Check {
  /** Read at render, so a cached result follows a change of language. */
  label: () => string;
  /** null: could not be checked by this viewer (for instance, no borrower ref). */
  ok: boolean | null;
  detail?: () => string;
}

export type Verdict = "VERIFIED" | "MISMATCH" | "MISSING" | "PENDING";

export async function audit(kind: AnchorKind, entityId: string) {
  const { data, error } = await platform.rpc("audit_record", { p_kind: kind, p_entity_id: entityId });
  if (error) throw error;
  const record = data as unknown as AuditRecord;
  const { anchor, payload } = record;

  if (anchor.status !== "confirmed" || !anchor.account_address || !anchor.commitment) {
    return { record, verdict: "PENDING" as Verdict, checks: [] as Check[], recomputed: null, onChain: null, canonical: null };
  }
  if (!payload) throw new Error(tr({ en: "The record behind this proof no longer exists.", pt: "O registro por trás desta prova não existe mais." }));

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
        label: () => tr({ en: "Decision, risk and confidence on chain match the record", pt: "Decisão, risco e confiança na blockchain batem com o registro" }),
        ok:
          EligibilityDecision[found.data.decision] === SNAKE_TO_PASCAL(p.decision) &&
          Grade[found.data.riskBand] === SNAKE_TO_PASCAL(p.risk_band) &&
          Grade[found.data.confidence] === SNAKE_TO_PASCAL(p.confidence),
      });
      if (borrower) {
        [expected] = await findEligibilityPda({ borrower, eligibilityNo: Number(p.eligibility_no) });
        const [readiness] = await findAttestationPda({ borrower, assessmentNo: Number(p.readiness_assessment_no) });
        checks.push({ label: () => tr({ en: "Relies on her own readiness attestation", pt: "Apoia-se no atestado de prontidão dela mesma" }), ok: found.data.readiness === readiness });
      }
    }
    const rerun = assessEligibility(p.inputs as unknown as EligibilityInput);
    checks.push({
      label: () => tr({ en: `Re-running ${rerun.model_version} on the stored inputs gives the same result`, pt: `Rodar de novo o ${rerun.model_version} com os dados guardados dá o mesmo resultado` }),
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
        checks.push({ label: () => tr({ en: "Comes from her eligibility attestation", pt: "Vem do atestado de elegibilidade dela" }), ok: found.data.eligibility === eligibility });
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
        checks.push({ label: () => tr({ en: "The measurement on chain is the one on record", pt: "A medição na blockchain é a do registro" }), ok: found.data.outcomeNo === Number(p.outcome_no) });
        if (loanAddress) {
          [expected] = await findOutcomePda({ loan: loanAddress, outcomeNo: Number(p.outcome_no) });
          checks.push({ label: () => tr({ en: "Measures her loan", pt: "Mede o empréstimo dela" }), ok: found.data.loan === loanAddress });
        }
      }
      // The arithmetic, redone here from the figures on record.
      const incremental = (Number(p.avg_net_after_cents) - Number(p.avg_net_before_cents)) * Number(p.months_after);
      checks.push({
        label: () => tr({ en: "Incremental profit is the change in monthly result times the months after the loan", pt: "O lucro incremental é a variação do resultado mensal vezes os meses após o empréstimo" }),
        ok: incremental === Number(p.incremental_profit_cents),
      });
      checks.push({
        label: () => tr({ en: "EVC (Economic Value Created) is the incremental profit less the cost of credit", pt: "O EVC (Valor Econômico Criado) é o lucro incremental menos o custo do crédito" }),
        ok: Number(p.evc_cents) === Number(p.incremental_profit_cents) - Number(p.cost_of_credit_cents),
      });
    } else if (kind === "payment") {
      const found = await fetchMaybePaymentCommitment(rpc, account);
      if (found.exists) {
        onChain = new Uint8Array(found.data.commitment);
        owner = found.programAddress;
        checks.push({ label: () => tr({ en: "The instalment on chain is the one on record", pt: "A parcela na blockchain é a do registro" }), ok: found.data.instalmentNo === Number(p.instalment_no) });
        if (loanAddress) {
          [expected] = await findPaymentPda({ loan: loanAddress, instalmentNo: Number(p.instalment_no) });
          checks.push({ label: () => tr({ en: "Belongs to her loan", pt: "Pertence ao empréstimo dela" }), ok: found.data.loan === loanAddress });
        }
      }
    } else {
      const found = await fetchMaybeLoanAccount(rpc, account);
      if (found.exists) {
        owner = found.programAddress;
        if (loanAddress) expected = loanAddress;
        if (kind === "loan") {
          onChain = new Uint8Array(found.data.termsCommitment);
          if (opportunity) checks.push({ label: () => tr({ en: "Opened from her opportunity", pt: "Aberto a partir da oportunidade dela" }), ok: found.data.opportunity === opportunity });
        } else {
          // Older transitions are no longer the loan's latest: read the
          // commitment from the transaction that made the change.
          const carried = record.anchor.signature ? await transitionInTransaction(record.anchor.signature) : null;
          onChain = carried ? new Uint8Array(carried.transitionCommitment) : null;
          checks.push({
            label: () => tr({
              en: `The transaction moved the loan to ${String(p.to_status).toLowerCase().replace("_", " ")}`,
              pt: `A transação levou o empréstimo para ${loanStatusWords(String(p.to_status))}`,
            }),
            ok: carried !== null && LoanStatus[carried.to] === SNAKE_TO_PASCAL(p.to_status),
          });
          checks.push({
            label: () => tr({ en: "The loan on chain has moved at least this far", pt: "O empréstimo na blockchain avançou pelo menos até aqui" }),
            ok: found.data.transitions >= 1,
            detail: () => tr({
              en: `now ${LoanStatus[found.data.status]}, after ${found.data.transitions} changes`,
              pt: `agora ${loanStatusWords(PASCAL_TO_SNAKE(LoanStatus[found.data.status]))}, após ${found.data.transitions} mudanças`,
            }),
          });
        }
      }
    }
  } else if (kind === "allocation") {
    const found = await fetchMaybeAllocationCommitment(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
    }
    // Keyed by the hash of a random reference: the account points to neither party.
    [expected] = await findAllocationPda({ allocationRefHash: await hashAllocationRef(fromHex(String(p.allocation_ref))) });
    if (p.deposit_signature && p.investor_wallet) {
      const moved = await depositToVault(String(p.deposit_signature), String(p.investor_wallet));
      checks.push({
        label: () => tr({ en: "The deposit moved this amount of USDC from the investor's wallet into the program's vault", pt: "O depósito levou este valor em USDC da carteira do investidor para o cofre do programa" }),
        ok: moved !== null && moved === BigInt(Number(p.amount_micro_usdc)),
        detail: () => (moved === null
          ? tr({ en: "deposit transaction not found", pt: "transação de depósito não encontrada" })
          : tr({
            en: `${usdc(moved)} on chain · ${usdc(Number(p.amount_micro_usdc))} allocated`,
            pt: `${usdc(moved)} na blockchain · ${usdc(Number(p.amount_micro_usdc))} alocados`,
          })),
      });
    } else {
      checks.push({ label: () => tr({ en: "A simulated position: no deposit on chain to check", pt: "Uma posição simulada: não há depósito na blockchain para conferir" }), ok: null });
    }
  } else if (kind === "consent") {
    const found = await fetchMaybeConsentCommitment(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
      checks.push({ label: () => tr({ en: "The record number on chain is the one on record", pt: "O número do registro na blockchain é o do registro" }), ok: found.data.consentNo === Number(p.consent_no) });
      if (borrower) {
        [expected] = await findConsentPda({ borrower, consentNo: Number(p.consent_no) });
        checks.push({ label: () => tr({ en: "Belongs to her borrower account", pt: "Pertence à conta da empreendedora" }), ok: found.data.borrower === borrower });
      }
    }
    // The rule the database enforces, checked again on what was committed.
    const scopes = (p.scopes ?? {}) as Record<string, boolean>;
    checks.push({
      label: () => tr({ en: "Each use builds on the one before: nothing shared that was not allowed to be assessed", pt: "Cada uso depende do anterior: nada foi compartilhado sem permissão para ser avaliado" }),
      ok: (scopes.assessment || !scopes.partner) && (scopes.partner || !scopes.investors),
    });
  } else if (kind === "checkin") {
    const found = await fetchMaybeCheckinCommitment(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
      checks.push({ label: () => tr({ en: "The month on chain is the month on record", pt: "O mês na blockchain é o mês do registro" }), ok: found.data.period === periodNumber(payload.period) });
      if (borrower) {
        [expected] = await findCheckinPda({ borrower, period: periodNumber(payload.period) });
        checks.push({ label: () => tr({ en: "Belongs to her borrower account", pt: "Pertence à conta da empreendedora" }), ok: found.data.borrower === borrower });
      }
    }
  } else if (kind === "readiness") {
    const found = await fetchMaybeReadinessAttestation(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.commitment);
      owner = found.programAddress;
      checks.push({
        label: () => tr({ en: "Status and band on chain match the record", pt: "Status e faixa na blockchain batem com o registro" }),
        ok:
          ReadinessStatus[found.data.status] === { CREDIT_READY: "CreditReady", NEEDS_MORE_DATA: "NeedsMoreData",
            NEEDS_PREPARATION: "NeedsPreparation", MANUAL_REVIEW: "ManualReview" }[String(payload.status)] &&
          ReadinessBand[found.data.band] === { LOW: "Low", MEDIUM: "Medium", HIGH: "High" }[String(payload.band)],
      });
      if (borrower) {
        [expected] = await findAttestationPda({ borrower, assessmentNo: Number(payload.assessment_no) });
        checks.push({ label: () => tr({ en: "Belongs to her borrower account", pt: "Pertence à conta da empreendedora" }), ok: found.data.borrower === borrower });
      }
    }
    // Deterministic and versioned, checked rather than claimed: run the same
    // engine, here, on the features stored with the assessment.
    const rerun = evaluateReadiness(payload.features as unknown as ReadinessFeatures);
    checks.push({
      label: () => tr({ en: `Re-running ${rerun.model_version} on the stored features gives the same result`, pt: `Rodar de novo o ${rerun.model_version} com os indicadores guardados dá o mesmo resultado` }),
      ok: RESULT_FIELDS.every((f) => sameJson({ v: rerun[f] }, { v: payload[f] })),
    });
  } else if (kind === "enrollment") {
    const found = await fetchMaybeBorrowerAudit(rpc, account);
    if (found.exists) {
      onChain = new Uint8Array(found.data.enrollmentCommitment);
      owner = found.programAddress;
      checks.push({
        label: () => tr({ en: "Registered through the community she joined", pt: "Cadastrada pela comunidade de que ela faz parte" }),
        ok: community !== null && found.data.community === community,
      });
      if (record.borrower_ref) {
        const refHash = await hashBorrowerRef(fromHex(record.borrower_ref));
        [expected] = await findBorrowerPda({ borrowerRefHash: refHash });
        checks.push({
          label: () => tr({ en: "Borrower ref hashes to the account's key", pt: "O hash da referência da empreendedora é a chave da conta" }),
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
    { label: () => tr({ en: "Recomputed commitment matches the one recorded", pt: "O compromisso recalculado bate com o registrado" }), ok: sameCommitment(recomputed, recorded) },
    { label: () => tr({ en: "Recomputed commitment matches the account on-chain", pt: "O compromisso recalculado bate com a conta na blockchain" }), ok: sameCommitment(recomputed, onChain) },
    { label: () => tr({ en: "Account is owned by the EmpowerFI audit program", pt: "A conta pertence ao programa de auditoria da EmpowerFI" }), ok: owner === EMPOWERFI_AUDIT_PROGRAM_ADDRESS },
  );
  checks.push(
    expected
      ? { label: () => tr({ en: "Account address matches its derivation (PDA)", pt: "O endereço da conta bate com sua derivação (PDA)" }), ok: expected === account }
      : {
          label: () => tr({ en: "Account address matches its derivation (PDA)", pt: "O endereço da conta bate com sua derivação (PDA)" }),
          ok: null,
          detail: () => (["community", "community_verification"].includes(kind)
            ? tr({ en: "community ref unavailable", pt: "referência da comunidade indisponível" })
            : tr({ en: "needs the borrower ref — auditors and admins only", pt: "precisa da referência da empreendedora, só para auditores e admins" })),
        },
  );

  const verdict: Verdict = checks.some((c) => c.ok === false) ? "MISMATCH" : "VERIFIED";
  return { record, verdict, checks, recomputed, onChain, canonical };
}

