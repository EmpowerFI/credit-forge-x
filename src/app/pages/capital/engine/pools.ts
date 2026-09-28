import type { PoolPolicy, RiskBand } from "@empowerfi/capital-allocation";
import type { CapitalOverview, PoolId } from "../../../lib/capital";

// A pool's assumptions as the drawer edits them, and in the engine's shape.

export interface PoolForm {
  available: string; // reais for domestic, USDC for global
  requiredReturn: string;
  bands: RiskBand[];
  minTicket: string;
  maxTicket: string;
  impact: boolean;
  purposes: string[];
  fxHedge: string;
  ramp: string;
}

const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pctToBps = (v: string) => Math.round(num(v) * 100);
const reaisToCents = (v: string) => Math.round(num(v) * 100);

export function formFor(p: CapitalOverview["pools"][number]): PoolForm {
  return {
    // What the pool may still put into the next request: capital, less what it
    // has lent, less what requests already listed on it are holding while they
    // raise. The same figure the database's allocation trigger decides on —
    // starting this page from "not lent" instead made it answer "Global P2P
    // selected" for a request the database had recorded as waiting for capital.
    available: p.pool === "domestic" ? String(p.available_cents / 100) : String((p.available_micro_usdc ?? 0) / 1e6),
    requiredReturn: String(p.policy.required_return_bps / 100),
    bands: p.policy.eligible_risk_bands,
    minTicket: String(p.policy.min_ticket_cents / 100),
    maxTicket: String(p.policy.max_ticket_cents / 100),
    impact: p.policy.impact_mandate,
    purposes: p.policy.purposes,
    fxHedge: String(p.policy.fx_hedge_bps / 100),
    ramp: String(p.policy.ramp_bps / 100),
  };
}

export function policyOf(id: PoolId, f: PoolForm, fxMilli: number): PoolPolicy {
  return {
    id,
    available_cents: id === "domestic" ? reaisToCents(f.available) : Math.floor(num(f.available) * fxMilli / 10),
    required_return_bps: pctToBps(f.requiredReturn),
    eligible_risk_bands: f.bands,
    min_ticket_cents: reaisToCents(f.minTicket),
    max_ticket_cents: reaisToCents(f.maxTicket),
    purposes: f.purposes,
    impact_mandate: f.impact,
    fx_hedge_bps: id === "domestic" ? 0 : pctToBps(f.fxHedge),
    ramp_bps: id === "domestic" ? 0 : pctToBps(f.ramp),
  };
}
