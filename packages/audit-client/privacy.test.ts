// What the program can ever write to Solana, checked from its IDL.
//
// Everything on chain is public and permanent: account data, and the
// instruction arguments kept in transaction history. Neither may carry a
// name, CPF, phone, e-mail, amount or any text. This test pins the shape:
// only fixed-size hashes, keys, small integers and enums, and exactly the
// fields listed below. Adding a field to an account is a privacy decision —
// make it here, deliberately, not as a side effect of a program change.
//
// The devnet counterpart, scripts/platform/scan-chain-pii.mts, decodes every
// account the program owns and searches it for the database's personal data.

import { describe, expect, it } from "vitest";
import idlJson from "./idl/empowerfi_audit.json";

type IdlType = string | { array: [IdlType, number] } | { defined: { name: string } } | Record<string, unknown>;
interface IdlField { name: string; type: IdlType }
interface Idl {
  accounts: { name: string }[];
  instructions: { name: string; args: IdlField[] }[];
  types: { name: string; type: { kind: "struct"; fields: IdlField[] } | { kind: "enum"; variants: { name: string; fields?: unknown[] }[] } }[];
}

const idl = idlJson as unknown as Idl;
const types = new Map(idl.types.map((t) => [t.name, t.type]));

const INTEGERS = new Set(["u8", "u16", "u32", "i64", "u64"]);

/** Why a type could carry personal data, or null if it cannot. */
function unsafe(type: IdlType): string | null {
  if (typeof type === "string") {
    if (type === "pubkey" || INTEGERS.has(type)) return null;
    return `type ${type}`; // string, bytes, and anything not reviewed here
  }
  if ("array" in type) {
    const [inner, size] = type.array as [IdlType, number];
    return inner === "u8" && size === 32 ? null : `array ${JSON.stringify(type.array)}`;
  }
  if ("defined" in type) {
    const def = types.get((type.defined as { name: string }).name);
    if (!def || def.kind !== "enum") return `defined type ${JSON.stringify(type.defined)}`;
    return def.variants.every((v) => !v.fields?.length) ? null : `enum with data ${JSON.stringify(type.defined)}`;
  }
  return `type ${JSON.stringify(type)}`; // vec, option, and anything else
}

// Every field of every account. A 32-byte array is a hash (commitment or
// reference hash); integers are sequence numbers, periods, versions and times —
// never an amount, which is why the names are pinned as well as the types.
const ACCOUNT_FIELDS: Record<string, string[]> = {
  PlatformConfig: ["authority", "operator", "created_at", "bump"],
  CommunityAudit: ["community_ref", "commitment", "status", "verification_commitment", "registered_at", "verified_at", "schema_version", "bump"],
  BorrowerAudit: ["borrower_ref_hash", "community", "enrollment_commitment", "registered_at", "schema_version", "bump"],
  CheckinCommitment: ["borrower", "period", "commitment", "anchored_at", "schema_version", "bump"],
  ReadinessAttestation: ["borrower", "assessment_no", "status", "band", "model_version", "commitment", "attested_at", "schema_version", "bump"],
  EligibilityAttestation: ["borrower", "readiness", "eligibility_no", "decision", "risk_band", "confidence", "model_version", "commitment", "attested_at", "schema_version", "bump"],
  OpportunityCommitment: ["borrower", "eligibility", "opportunity_no", "commitment", "created_at", "schema_version", "bump"],
  LoanAccount: ["borrower", "opportunity", "status", "terms_commitment", "last_transition_commitment", "transitions", "created_at", "updated_at", "schema_version", "bump"],
  PaymentCommitment: ["loan", "instalment_no", "commitment", "recorded_at", "schema_version", "bump"],
  OutcomeCommitment: ["loan", "outcome_no", "commitment", "measured_at", "schema_version", "bump"],
  AllocationCommitment: ["allocation_ref_hash", "commitment", "allocated_at", "schema_version", "bump"],
};

// Every argument of every instruction, which transaction history keeps.
const INSTRUCTION_ARGS: Record<string, string[]> = {
  anchor_allocation: ["allocation_ref_hash", "commitment"],
  anchor_checkin: ["period", "commitment"],
  anchor_opportunity: ["opportunity_no", "commitment"],
  anchor_outcome: ["outcome_no", "commitment"],
  anchor_payment: ["instalment_no", "commitment"],
  attest_eligibility: ["eligibility_no", "decision", "risk_band", "confidence", "model_version", "commitment"],
  attest_readiness: ["assessment_no", "status", "band", "model_version", "commitment"],
  create_loan: ["terms_commitment"],
  initialize_platform: ["operator"],
  register_borrower_ref: ["borrower_ref_hash", "enrollment_commitment"],
  register_community: ["community_ref", "commitment"],
  set_operator: ["operator"],
  transition_loan: ["to", "transition_commitment"],
  verify_community: ["verification_commitment"],
};

describe("on-chain privacy, from the IDL", () => {
  it("has exactly the accounts reviewed here", () => {
    expect(idl.accounts.map((a) => a.name).sort()).toEqual(Object.keys(ACCOUNT_FIELDS).sort());
  });

  for (const account of idl.accounts) {
    it(`${account.name} holds only the reviewed fields, none able to carry text or amounts`, () => {
      const def = types.get(account.name);
      expect(def?.kind).toBe("struct");
      const fields = def!.kind === "struct" ? def!.fields : [];
      expect(fields.map((f) => f.name)).toEqual(ACCOUNT_FIELDS[account.name]);
      expect(fields.map((f) => [f.name, unsafe(f.type)]).filter(([, why]) => why)).toEqual([]);
    });
  }

  it("takes only the reviewed instruction arguments, none able to carry text or amounts", () => {
    expect(Object.fromEntries(idl.instructions.map((ix) => [ix.name, ix.args.map((a) => a.name)]))).toEqual(INSTRUCTION_ARGS);
    const risky = idl.instructions.flatMap((ix) =>
      ix.args.map((a) => [`${ix.name}.${a.name}`, unsafe(a.type)] as const).filter(([, why]) => why),
    );
    expect(risky).toEqual([]);
  });
});
