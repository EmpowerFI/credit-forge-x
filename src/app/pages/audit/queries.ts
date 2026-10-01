import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { CanonicalObject } from "@empowerfi/audit-commitments";
import type { AnchorKind } from "../../lib/platform";
import { platform } from "../../lib/platform";
import type { Proof } from "../../lib/community";
import type { ZcashStatus } from "../../lib/zcash";

// The audit console's reads. Every one is for auditors and admins only, and
// names participants by code, never by name.

export type AttestationState = "queued" | "failed" | "verified" | "unchecked" | "flagged";

export interface Attestation {
  id: number;
  kind: AnchorKind;
  entity_id: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  reconcile: "unchecked" | "verified" | "missing" | "mismatch";
  reconcile_note: string | null;
  commitment: string | null;
  account: string | null;
  signature: string | null;
  slot: number | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  confirmed_at: string | null;
  reconciled_at: string | null;
  participant: string | null;
  model_version: string | null;
}

export interface Attestations {
  total: number;
  rows: Attestation[];
  by_kind: Partial<Record<AnchorKind, number>>;
  by_state: Record<AttestationState | "confirmed", number>;
}

export function useAttestations(kind: AnchorKind | null, state: AttestationState | null, page: number, size = 25) {
  return useQuery({
    queryKey: ["platform", "audit-attestations", kind, state, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_attestations", {
        p_kind: kind ?? undefined, p_state: state ?? undefined, p_limit: size, p_offset: page * size,
      });
      if (error) throw error;
      return data as unknown as Attestations;
    },
    refetchInterval: 15_000,
  });
}

export interface AuditEvent {
  at: string;
  kind: string;
  actor: string;
  label: string | null;
  participant: string | null;
  community: string | null;
  proof: Proof | null;
}

export function useEvents(kind: string | null) {
  return useQuery({
    queryKey: ["platform", "audit-events", kind],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_events", { p_kind: kind ?? undefined, p_limit: 200 });
      if (error) throw error;
      return data as unknown as AuditEvent[];
    },
  });
}

export interface ModelVersion { version: string; runs: number; first_at: string; last_at: string; outcomes: Record<string, number>; anchored: number }
export interface Models { readiness: ModelVersion[]; eligibility: ModelVersion[]; outcome: ModelVersion[] }

export function useModels() {
  return useQuery({
    queryKey: ["platform", "audit-models"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_models");
      if (error) throw error;
      return data as unknown as Models;
    },
  });
}

export interface ModelSample { readiness: { id: string; payload: CanonicalObject }[]; eligibility: { id: string; payload: CanonicalObject }[] }

export async function fetchModelSample(limit = 12) {
  const { data, error } = await platform.rpc("audit_model_sample", { p_limit: limit });
  if (error) throw error;
  return data as unknown as ModelSample;
}

export interface ConsentAudit {
  enrolled: number;
  with_record: number;
  without_record: number;
  records: number;
  changes: number;
  by_scope: Record<"assessment" | "partner" | "investors" | "impact", number>;
  by_channel: { app: number; community: number };
  anchored: number;
  checks: Record<"assessed_without_consent" | "eligibility_without_consent" | "referred_without_consent" | "listed_without_consent", number>;
  recent: {
    id: string; at: string; participant: string; community: string | null; consent_no: number; text_version: string;
    assessment: boolean; partner: boolean; investors: boolean; impact: boolean; channel: "app" | "community"; proof: Proof | null;
  }[];
}

export function useConsentAudit() {
  return useQuery({
    queryKey: ["platform", "audit-consents"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_consents");
      if (error) throw error;
      return data as unknown as ConsentAudit;
    },
  });
}

export interface SystemAudit {
  anchors: { pending: number; submitted: number; failed: number; confirmed: number; oldest_queued_at: string | null; last_confirmed_at: string | null; last_error: string | null };
  reconcile: { verified: number; missing: number; mismatch: number; unchecked: number; last_at: string | null; oldest_at: string | null };
  refunds: { due: number; sending: number; refunded: number; last_at: string | null; last_error: string | null };
  vault: { expected_micro_usdc: number; deposited_micro_usdc: number; refunded_micro_usdc: number; deposits: number; zcash_micro_usdc: number;
    released_micro_usdc: number; repaid_in_micro_usdc: number; paid_out_micro_usdc: number };
  settlement: { due: number; sending: number; held: number; failed: number; last_error: string | null };
  zcash: { scanned_height: number | null; tip_height: number | null; scanned_at: string | null } | null;
  jobs: { name: string; schedule: string; active: boolean }[] | null;
}

export interface ZcashReceipt {
  txid: string;
  pool: "sapling" | "orchard" | "ironwood";
  index: number;
  value_zat: number;
  memo: string | null;
  height: number;
  seen_at: string;
  ref: string | null;
  status: ZcashStatus | null;
  amount_micro_usdc: number | null;
  opportunity_code: string | null;
  credit_signature: string | null;
  allocation_signature: string | null;
}

export type ZcashAudit =
  | { configured: false }
  | {
      configured: true;
      network: "test" | "main";
      address: string;
      ufvk: string;
      birthday_height: number;
      scanned_height: number | null;
      tip_height: number | null;
      scanned_at: string | null;
      confirmations_needed: number;
      received_zat: number;
      requests: Partial<Record<ZcashStatus, number>> | null;
      batches: ZcashBatchQueue;
      receipts: ZcashReceipt[];
    };

/**
 * The vault against the book, and the batches behind the difference. Published
 * because a batch hides amounts by crediting the vault in whole units and
 * carrying the rest, which leaves the vault short of the book between batches —
 * and a privacy mechanism that hides its own float is bookkeeping with the
 * lights off.
 */
export type ZcashBatchQueue = {
  booked_micro_usdc: number;
  credited_micro_usdc: number;
  queued_micro_usdc: number;
  awaiting_micro_usdc: number;
  batches: {
    id: string;
    status: "open" | "sending" | "credited" | "failed";
    signature: string | null;
    unit_micro_usdc: number;
    credited_micro_usdc: number;
    carried_in_micro_usdc: number;
    carried_out_micro_usdc: number;
    /** Positions in the batch: what blends the individual amounts. */
    members: number;
    /** People in the batch: what blends the totals. One is not a crowd. */
    investors: number;
    created_at: string;
    confirmed_at: string | null;
  }[];
};

export function useZcashAudit() {
  return useQuery({
    queryKey: ["platform", "audit-zcash"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_zcash");
      if (error) throw error;
      return data as unknown as ZcashAudit;
    },
    refetchInterval: 20_000,
  });
}

export function useSystemAudit() {
  return useQuery({
    queryKey: ["platform", "audit-system"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_system");
      if (error) throw error;
      return data as unknown as SystemAudit;
    },
    refetchInterval: 15_000,
  });
}

export interface ZcashReturnsAudit {
  counts: Partial<Record<"due" | "sending" | "sent" | "failed", number>>;
  sent_zat: number;
  rows: { kind: "payout" | "refund"; ref: string | null; amount_micro_usdc: number; amount_zat: number | null; usd_per_zec_cents: number | null;
    status: "due" | "sending" | "sent" | "failed"; txid: string | null; error: string | null; created_at: string; sent_at: string | null }[];
}

export function useZcashReturnsAudit() {
  return useQuery({
    queryKey: ["platform", "audit-zcash-returns"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("audit_zcash_returns");
      if (error) throw error;
      return data as unknown as ZcashReturnsAudit;
    },
    refetchInterval: 20_000,
  });
}
