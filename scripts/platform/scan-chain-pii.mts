// Zero-PII scan of everything the audit program holds on devnet.
//
//   PLATFORM_SERVICE_KEY_FILE=<file with the service role key> \
//   SOLANA_RPC_URL=<devnet RPC, optional> \
//   npx tsx scripts/platform/scan-chain-pii.mts
//
// Reads every account the program owns and checks two things:
//
//   1. Shape. Each account is one of the reviewed types, at its fixed size,
//      and decodes cleanly: hashes, keys, small integers and enums only
//      (packages/audit-client/privacy.test.ts pins that shape from the IDL).
//   2. Content. None contains any personal or financial value the database
//      holds. Names, business names, e-mails, community names and cities are
//      searched for as text anywhere in the bytes. Reported sales, costs,
//      household spending and loan amounts are looked for in every decoded
//      integer field — not in the raw bytes, where adjacent small fields
//      (a sequence number 1, then enum zeros) read by chance as an amount.
//
// Exits non-zero on any finding. Read-only on both sides.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createSolanaRpc, type Address } from "@solana/kit";
import {
  EMPOWERFI_AUDIT_PROGRAM_ADDRESS,
  EmpowerfiAuditAccount,
  getAllocationCommitmentDecoder,
  getBorrowerAuditDecoder,
  getCheckinCommitmentDecoder,
  getCommunityAuditDecoder,
  getConsentCommitmentDecoder,
  getEligibilityAttestationDecoder,
  getLoanAccountDecoder,
  getOpportunityCommitmentDecoder,
  getOutcomeCommitmentDecoder,
  getPaymentCommitmentDecoder,
  getPlatformConfigDecoder,
  getReadinessAttestationDecoder,
  identifyEmpowerfiAuditAccount,
} from "../../packages/audit-client/src/generated/index.ts";

const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
const keyFile = process.env.PLATFORM_SERVICE_KEY_FILE;
if (!keyFile) throw new Error("set PLATFORM_SERVICE_KEY_FILE");
const db = createClient(URL, readFileSync(keyFile, "utf8").trim(), { auth: { persistSession: false } });
const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com");

const DECODERS = {
  [EmpowerfiAuditAccount.PlatformConfig]: getPlatformConfigDecoder(),
  [EmpowerfiAuditAccount.CommunityAudit]: getCommunityAuditDecoder(),
  [EmpowerfiAuditAccount.BorrowerAudit]: getBorrowerAuditDecoder(),
  [EmpowerfiAuditAccount.CheckinCommitment]: getCheckinCommitmentDecoder(),
  [EmpowerfiAuditAccount.ReadinessAttestation]: getReadinessAttestationDecoder(),
  [EmpowerfiAuditAccount.EligibilityAttestation]: getEligibilityAttestationDecoder(),
  [EmpowerfiAuditAccount.OpportunityCommitment]: getOpportunityCommitmentDecoder(),
  [EmpowerfiAuditAccount.LoanAccount]: getLoanAccountDecoder(),
  [EmpowerfiAuditAccount.PaymentCommitment]: getPaymentCommitmentDecoder(),
  [EmpowerfiAuditAccount.OutcomeCommitment]: getOutcomeCommitmentDecoder(),
  [EmpowerfiAuditAccount.AllocationCommitment]: getAllocationCommitmentDecoder(),
  [EmpowerfiAuditAccount.ConsentCommitment]: getConsentCommitmentDecoder(),
} as const;

// ------------------------------------------------------------------ needles

async function all<T>(what: string, query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

const texts = new Set<string>();
const addText = (value: string | null | undefined) => {
  const v = value?.trim();
  if (!v || v.length < 4) return;
  texts.add(v);
  for (const part of v.split(/\s+/)) if (part.length >= 5) texts.add(part); // surnames on their own
};

for (const e of await all("entrepreneurs", (a, b) => db.from("entrepreneurs").select("display_name, business_name").range(a, b))) {
  addText((e as { display_name: string }).display_name);
  addText((e as { business_name: string | null }).business_name);
}
for (const p of await all("profiles", (a, b) => db.from("profiles").select("display_name").range(a, b))) addText((p as { display_name: string }).display_name);
for (const c of await all("communities", (a, b) => db.from("communities").select("name, city").range(a, b))) {
  addText((c as { name: string }).name);
  addText((c as { city: string }).city);
}
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) addText(u.email);
  if (data.users.length < 1000) break;
}

const amounts = new Set<bigint>();
for (const c of await all("checkins", (a, b) => db.from("checkins").select("revenue_cents, cogs_cents, opex_cents, household_cents").range(a, b))) {
  for (const v of Object.values(c as Record<string, number>)) if (v >= 10_000) amounts.add(BigInt(v)); // R$ 100 and up
}
for (const l of await all("loans", (a, b) => db.from("loans").select("principal_cents, instalment_cents").range(a, b))) {
  for (const v of Object.values(l as Record<string, number>)) if (v >= 10_000) amounts.add(BigInt(v));
}

const encoder = new TextEncoder();
const textNeedles = [...texts].flatMap((t) => [...new Set([t, t.toLowerCase(), t.toUpperCase()])].map((s) => ({ what: `text "${s}"`, bytes: encoder.encode(s) })));
const needles = textNeedles;

/** Every integer in a decoded account, by field name; months (YYYYMM) aside. */
function integers(value: unknown, path = ""): [string, bigint][] {
  if (typeof value === "number" && Number.isInteger(value)) return [[path, BigInt(value)]];
  if (typeof value === "bigint") return [[path, value]];
  if (value instanceof Uint8Array || Array.isArray(value)) return []; // hashes and keys
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => (k === "period" ? [] : integers(v, path ? `${path}.${k}` : k)));
  }
  return [];
}

function indexOf(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// -------------------------------------------------------------------- scan

const accounts = await rpc.getProgramAccounts(EMPOWERFI_AUDIT_PROGRAM_ADDRESS as Address, { encoding: "base64" }).send();
const findings: string[] = [];
const byType = new Map<string, number>();

for (const { pubkey, account } of accounts) {
  const data = new Uint8Array(Buffer.from(account.data[0], "base64"));
  let type: EmpowerfiAuditAccount;
  try {
    type = identifyEmpowerfiAuditAccount(data);
  } catch {
    findings.push(`${pubkey}: not one of the reviewed account types`);
    continue;
  }
  const decoder = (DECODERS as Partial<Record<EmpowerfiAuditAccount, (typeof DECODERS)[keyof typeof DECODERS]>>)[type];
  if (!decoder) {
    findings.push(`${pubkey}: ${EmpowerfiAuditAccount[type]} has not been reviewed by this scan`);
    continue;
  }
  if (data.length !== decoder.fixedSize) findings.push(`${pubkey}: ${EmpowerfiAuditAccount[type]} is ${data.length} bytes, expected ${decoder.fixedSize}`);
  try {
    for (const [field, v] of integers(decoder.decode(data))) {
      if (amounts.has(v)) findings.push(`${pubkey} (${EmpowerfiAuditAccount[type]}): field ${field} holds amount ${v}`);
    }
  } catch (err) {
    findings.push(`${pubkey}: does not decode as ${EmpowerfiAuditAccount[type]} (${(err as Error).message})`);
  }
  // An e-mail address, whatever it is.
  const ascii = Buffer.from(data).toString("latin1");
  if (/[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9-]{2,}\.[A-Za-z]{2,}/.test(ascii)) findings.push(`${pubkey}: contains something shaped like an e-mail address`);
  for (const n of needles) {
    if (indexOf(data, n.bytes) >= 0) findings.push(`${pubkey} (${EmpowerfiAuditAccount[type]}): contains ${n.what}`);
  }
  byType.set(EmpowerfiAuditAccount[type], (byType.get(EmpowerfiAuditAccount[type]) ?? 0) + 1);
}

console.log(`program ${EMPOWERFI_AUDIT_PROGRAM_ADDRESS}`);
console.log(`accounts scanned: ${accounts.length}`);
for (const [t, n] of [...byType].sort()) console.log(`  ${t}: ${n}`);
console.log(`searched for: ${texts.size} names, e-mails and places (as written, lower and upper case); ${amounts.size} amounts (in every decoded integer field)`);
if (findings.length) {
  console.log(`\nFINDINGS: ${findings.length}`);
  for (const f of findings.slice(0, 50)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("\nzero personal data on chain: no names, e-mails, places or amounts; every account a reviewed type");
