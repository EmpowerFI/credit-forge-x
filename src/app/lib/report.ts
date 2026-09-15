import {
  type Address,
  address,
  getAddressEncoder,
  getBase64Encoder,
  type Signature,
} from "@solana/kit";
import type { ConsentAudit, Models } from "../pages/audit/queries";
import { platform } from "./platform";
import { PROGRAM_ID, rpc, vaultAddress } from "./solana";

// A shareable audit report: what the audit console showed when an auditor
// froze it, the checks the auditor's browser ran, and — for whoever opens the
// link — the same checks run again against Solana from their own browser.

export interface ReportProof {
  kind: string;
  commitment: string | null;
  account: string | null;
  signature: string;
  slot: number | null;
  confirmed_at: string;
  reconcile: string;
}

interface Movement { signature: string; amount_micro_usdc: number; at: string | null }

export interface ReportSnapshot {
  generated_at: string;
  chain: { cluster: string; program_id: string; usdc_mint: string };
  anchors: {
    total: number; confirmed: number; queued: number; failed: number;
    verified: number; mismatch: number; missing: number; unchecked: number;
    first_confirmed_at: string | null; last_confirmed_at: string | null; last_reconciled_at: string | null;
    by_kind: Record<string, { total: number; confirmed: number; verified: number }>;
  };
  models: Models;
  consent: Omit<ConsentAudit, "recent">;
  credit: {
    communities: number; participants: number; credit_ready: number;
    eligibility: Record<string, number>; referred: number; decisions: Record<string, number>;
    loans: Record<string, number>; lent_cents: number; instalments: number; repaid_cents: number; outcomes: number;
  };
  vault: {
    expected_micro_usdc: number; deposits_micro_usdc: number; released_micro_usdc: number;
    repaid_in_micro_usdc: number; paid_out_micro_usdc: number; deposits: number; zcash_micro_usdc: number;
    refunded: number; refunded_micro_usdc: number; simulated_positions: number;
  };
  settlement: {
    legs: Record<string, number>;
    transfers: { kind: "release" | "payout"; signature: string; inflow_micro_usdc: number; outflow_micro_usdc: number; at: string }[];
    deposits: Movement[];
    refunds: Movement[];
  };
  zcash: {
    network: string; address: string; birthday_height: number; scanned_height: number | null; confirmations_needed: number;
    received_zat: number;
    receipts: { txid: string; pool: string; value_zat: number; height: number; credited: boolean; credit_signature: string | null }[];
    returns: { kind: "payout" | "refund"; txid: string; amount_zat: number; amount_micro_usdc: number; sent_at: string }[];
  } | null;
  proofs: ReportProof[];
}

/** What a browser found on Solana for a report's proofs and transfers. */
export interface ChainCheck {
  at: string;
  rpc: "public" | "custom";
  proofs: { checked: number; landed: number; commitment_found: number; problems: { signature: string; kind: string; issue: string }[] };
  transfers: { checked: number; landed: number; problems: string[] };
  vault: { address: string; chain_micro_usdc: number | null };
}

export interface ReportChecks {
  models?: { checked: number; reproduced: number; at: string };
  vault?: { address: string; chain_micro_usdc: number | null; expected_micro_usdc: number; at: string };
  chain?: ChainCheck;
}

export interface SharedReport { title: string; created_at: string; snapshot: ReportSnapshot; checks: ReportChecks }

export interface ReportRow {
  id: string; token: string; title: string; created_at: string; revoked_at: string | null;
  created_by: string | null; proofs: number; checks: ReportChecks;
}

export const reportUrl = (token: string) => `${window.location.origin}/app/report/${token}`;

export async function fetchSharedReport(token: string): Promise<SharedReport> {
  const { data, error } = await platform.rpc("shared_audit_report", { p_token: token });
  if (error) throw error;
  return data as unknown as SharedReport;
}

// ------------------------------------------------------------- on chain

const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));
const fromBase64 = (b64: string) => new Uint8Array(getBase64Encoder().encode(b64));

/** Whether `needle` occurs in `hay`: a 32-byte commitment is never there by chance. */
export function contains(hay: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

const chunks = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

async function statuses(signatures: string[]) {
  const out = new Map<string, boolean>();
  for (const batch of chunks(signatures, 200)) {
    const { value } = await rpc.getSignatureStatuses(batch as Signature[], { searchTransactionHistory: true }).send();
    batch.forEach((s, i) => out.set(s, Boolean(value[i] && !value[i]!.err)));
  }
  return out;
}

/**
 * Looks a report's proofs and transfers up on Solana. For each proof: did its
 * transaction land, and is its commitment there — in the account the program
 * owns, or, for a record an account has since moved past (a loan's earlier
 * status), in the transaction that wrote it. Reads the vault's balance too.
 * Nothing here trusts EmpowerFI's servers: every answer comes from the RPC.
 */
export async function checkOnChain(snapshot: ReportSnapshot, onProgress?: (step: string) => void): Promise<ChainCheck> {
  const program = new Uint8Array(getAddressEncoder().encode(PROGRAM_ID));
  const proofs = snapshot.proofs.filter((p) => p.commitment);
  const problems: ChainCheck["proofs"]["problems"] = [];

  onProgress?.(`Looking up ${proofs.length} proof transactions`);
  const landed = await statuses(proofs.map((p) => p.signature));

  onProgress?.("Reading the accounts that hold the commitments");
  const found = new Set<string>();
  const withAccount = proofs.filter((p) => p.account);
  for (const batch of chunks(withAccount, 100)) {
    const { value } = await rpc.getMultipleAccounts(batch.map((p) => address(p.account!)) as Address[], { encoding: "base64" }).send();
    batch.forEach((p, i) => {
      const acc = value[i];
      if (acc && acc.owner === PROGRAM_ID && contains(fromBase64(acc.data[0]), fromHex(p.commitment!))) found.add(p.signature);
    });
  }

  // The rest: in the transaction itself, a few at a time to spare the public RPC.
  const rest = proofs.filter((p) => !found.has(p.signature) && landed.get(p.signature));
  onProgress?.(rest.length ? `Reading ${rest.length} transactions for commitments an account has moved past` : "Commitments read");
  for (const batch of chunks(rest, 4)) {
    await Promise.all(batch.map(async (p) => {
      const tx = await rpc.getTransaction(p.signature as Signature, { encoding: "base64", maxSupportedTransactionVersion: 0 }).send()
        .catch(() => null);
      if (!tx) return;
      const raw = fromBase64(tx.transaction[0]);
      if (contains(raw, program) && contains(raw, fromHex(p.commitment!))) found.add(p.signature);
    }));
  }
  for (const p of proofs) {
    if (!landed.get(p.signature)) problems.push({ signature: p.signature, kind: p.kind, issue: "transaction not found" });
    else if (!found.has(p.signature)) problems.push({ signature: p.signature, kind: p.kind, issue: "commitment not found" });
  }

  const movements = [
    ...snapshot.settlement.transfers.map((t) => t.signature),
    ...snapshot.settlement.deposits.map((d) => d.signature),
    ...snapshot.settlement.refunds.map((r) => r.signature),
    ...(snapshot.zcash?.receipts ?? []).flatMap((r) => (r.credit_signature ? [r.credit_signature] : [])),
  ].filter(Boolean);
  onProgress?.(`Looking up ${movements.length} vault transactions`);
  const moved = await statuses(movements);

  onProgress?.("Reading the vault's balance");
  const vault = await vaultAddress();
  const balance = await rpc.getTokenAccountBalance(vault, { commitment: "confirmed" }).send()
    .then(({ value }) => Number(value.amount)).catch(() => null);

  return {
    at: new Date().toISOString(),
    rpc: import.meta.env.VITE_SOLANA_RPC_URL ? "custom" : "public",
    proofs: { checked: proofs.length, landed: proofs.filter((p) => landed.get(p.signature)).length, commitment_found: found.size, problems },
    transfers: { checked: movements.length, landed: movements.filter((s) => moved.get(s)).length, problems: movements.filter((s) => !moved.get(s)) },
    vault: { address: vault, chain_micro_usdc: balance },
  };
}
