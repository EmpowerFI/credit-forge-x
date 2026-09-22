// Zero-PII scan of everything the audit program holds on devnet.
//
//   PLATFORM_SERVICE_KEY_FILE=<file with the service role key> \
//   SOLANA_RPC_URL=<devnet RPC, optional> \
//   npx tsx scripts/platform/scan-chain-pii.mts
//
// Covers two things on chain: the audit program's own accounts, and the
// Token-2022 mints behind the tokenised credit positions.
//
// For the audit program it reads every account it owns and checks two things:
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
// A position's mint is checked differently, because it is not ours to decode:
// it must be a Token-2022 mint of the expected size, with a supply of one, no
// decimals, no metadata and none of the same needles in its bytes. The asset
// id and the investor stay in the database; on chain a position is an address.
//
// Exits non-zero on any finding. Read-only on both sides.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createSolanaRpc, type Address } from "@solana/kit";
import {
  AccountState, extension, getMintDecoder, getMintSize, TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
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
  getSettlementRouteCommitmentDecoder,
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
  [EmpowerfiAuditAccount.SettlementRouteCommitment]: getSettlementRouteCommitmentDecoder(),
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
for (const p of await all("credit_positions", (a, b) => db.from("credit_positions").select("principal_micro_usdc").range(a, b))) {
  const v = (p as { principal_micro_usdc: number }).principal_micro_usdc;
  if (v >= 10_000) amounts.add(BigInt(v)); // an investor's share is hers, not the chain's
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

// --------------------------------------------------------- position mints

const positions = await all("credit_positions", (a, b) =>
  db.from("credit_positions").select("asset_no, mint_address, token_account").not("mint_address", "is", null).range(a, b)) as
  { asset_no: number; mint_address: string; token_account: string | null }[];
const MINT_SIZE = getMintSize([extension("DefaultAccountState", { state: AccountState.Frozen })]);
const mintDecoder = getMintDecoder();

for (let i = 0; i < positions.length; i += 100) {
  const batch = positions.slice(i, i + 100);
  const { value } = await rpc.getMultipleAccounts(batch.map((p) => p.mint_address as Address), { encoding: "base64" }).send();
  for (const [k, account] of value.entries()) {
    const asset = `EF-CREDIT-${batch[k].asset_no}`;
    if (!account) {
      findings.push(`${asset}: the database has a mint address that does not exist on chain`);
      continue;
    }
    if (account.owner !== TOKEN_2022_PROGRAM_ADDRESS) findings.push(`${asset}: mint is owned by ${account.owner}, not the Token-2022 program`);
    const data = new Uint8Array(Buffer.from(account.data[0], "base64"));
    // Bigger than the mint plus its one extension means something was added.
    if (data.length !== MINT_SIZE) findings.push(`${asset}: mint is ${data.length} bytes, expected ${MINT_SIZE} (mint + DefaultAccountState, nothing else)`);
    try {
      const mint = mintDecoder.decode(data);
      if (mint.supply !== 1n) findings.push(`${asset}: supply is ${mint.supply}, expected 1`);
      if (mint.decimals !== 0) findings.push(`${asset}: ${mint.decimals} decimals, expected 0`);
    } catch (err) {
      findings.push(`${asset}: does not decode as a Token-2022 mint (${(err as Error).message})`);
    }
    const ascii = Buffer.from(data).toString("latin1");
    if (/[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9-]{2,}\.[A-Za-z]{2,}/.test(ascii)) findings.push(`${asset}: contains something shaped like an e-mail address`);
    if (/EF-CREDIT/.test(ascii)) findings.push(`${asset}: carries its asset id on chain; the id belongs in the database`);
    for (const n of needles) if (indexOf(data, n.bytes) >= 0) findings.push(`${asset}: contains ${n.what}`);
  }
}

console.log(`program ${EMPOWERFI_AUDIT_PROGRAM_ADDRESS}`);
console.log(`accounts scanned: ${accounts.length}`);
for (const [t, n] of [...byType].sort()) console.log(`  ${t}: ${n}`);
console.log(`position mints scanned: ${positions.length} (Token-2022, ${MINT_SIZE} bytes, supply 1, no metadata)`);
console.log(`searched for: ${texts.size} names, e-mails and places (as written, lower and upper case); ${amounts.size} amounts (in every decoded integer field)`);
if (findings.length) {
  console.log(`\nFINDINGS: ${findings.length}`);
  for (const f of findings.slice(0, 50)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("\nzero personal data on chain: no names, e-mails, places or amounts; every account a reviewed type, every position mint a bare Token-2022 mint");
