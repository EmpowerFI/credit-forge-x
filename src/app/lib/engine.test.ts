import { describe, expect, it } from "vitest";
import { allocate, type PoolPolicy } from "@empowerfi/capital-allocation";
import { creditSteps, creditStop, economics, type EngineOpportunity, orderedChecks, runPlan, stateAt } from "./engine";

const DOMESTIC: PoolPolicy = {
  id: "domestic", available_cents: 1_780_000, required_return_bps: 1600, eligible_risk_bands: ["LOW", "MEDIUM"],
  min_ticket_cents: 50_000, max_ticket_cents: 400_000, purposes: [], impact_mandate: false, fx_hedge_bps: 0, ramp_bps: 0,
};
const GLOBAL: PoolPolicy = {
  id: "global", available_cents: 2_200_500, required_return_bps: 800, eligible_risk_bands: ["LOW", "MEDIUM"],
  min_ticket_cents: 100_000, max_ticket_cents: 1_000_000, purposes: ["working_capital", "inventory", "equipment"],
  impact_mandate: true, fx_hedge_bps: 500, ramp_bps: 100,
};

const opportunity = (over: Partial<EngineOpportunity> = {}): EngineOpportunity => ({
  opportunity_id: "o", code: "Q-7ABFD2", queued: "0", created_at: "2026-09-10T12:00:00Z", status: "open",
  purpose: "inventory", business_sector: "food", community: "Grajaú", community_city: "São Paulo", community_state: "SP",
  documents: ["cpf", "proof_of_activity"],
  amount_cents: 220_000, term_months: 6, instalment_cents: 41_000, risk_band: "LOW", confidence: "HIGH", impact_eligible: true,
  funding_status: "open", funding_pool: "domestic", settled: false, reached: "raising", allocation: null, allocation_reason_codes: ["DOMESTIC_LIQUIDITY_AVAILABLE"],
  allocation_model_version: "capital-allocation-v1.0.0", allocated_at: null,
  funding_target_micro_usdc: null, fx_brl_per_usdc_milli: null,
  readiness: {
    status: "CREDIT_READY", score: 97, band: "HIGH", model_version: "readiness-v0.1.0", as_of_period: "2026-09", assessed_at: "",
    months_reported: 6, consecutive_months: 6, records_kept_bps: 10_000, positive_months_last3: 3,
    core_modules_completed: 5, core_modules_total: 5, community_verified: true,
  },
  eligibility: {
    decision: "ELIGIBLE", model_version: "eligibility-v0.1.0", assessed_at: "", requested_cents: 220_000, proposed_cents: 220_000,
    affordability_bps: 2097, risk_band: "LOW", confidence: "HIGH", reason_codes: ["AFFORDABLE"],
  },
  proofs: [],
  ...over,
});

describe("engine page", () => {
  it("qualifies a listed opportunity through all six credit steps", () => {
    const steps = creditSteps(opportunity());
    expect(steps.map((s) => s.id)).toEqual(["business_data", "preparation", "readiness", "affordability", "risk", "eligibility"]);
    expect(creditStop(steps)).toBeNull();
  });

  it("stops Engine 1 at the first step that did not pass, and never asks a pool", () => {
    const held = opportunity({ status: "in_review", eligibility: { ...opportunity().eligibility, decision: "MANUAL_REVIEW" } });
    expect(creditStop(creditSteps(held))).toBe("eligibility");
    const thin = opportunity({ readiness: { ...opportunity().readiness, months_reported: 2, consecutive_months: 2 } });
    const steps = creditSteps(thin);
    expect(creditStop(steps)).toBe("business_data");
    const plan = runPlan(steps, null);
    expect(plan.rejected).toBe(true);
    expect(stateAt(0, plan, null)).toBe("RUNNING_CREDIT_ENGINE");
    expect(stateAt(plan.creditTicks, plan, null)).toBe("CREDIT_REJECTED");
  });

  it("case A: both pools can fund a six-month loan, and domestic costs her less", () => {
    const o = opportunity();
    const r = allocate(o, DOMESTIC, GLOBAL);
    expect(r.pool).toBe("domestic");
    expect(r.reason_codes).toContain("DOMESTIC_LOWEST_COST");
    expect(economics(r, "domestic", DOMESTIC)).toEqual({ required_return_bps: 1600, loss_and_serve_bps: 900, fx_hedge_bps: 0, ramp_bps_year: 0, all_in_bps: 2500 });
    expect(economics(r, "global", GLOBAL)).toEqual({ required_return_bps: 800, loss_and_serve_bps: 900, fx_hedge_bps: 500, ramp_bps_year: 400, all_in_bps: 2600 });
    const plan = runPlan(creditSteps(o), r);
    expect(stateAt(plan.total, plan, r)).toBe("DOMESTIC_SELECTED");
    expect(stateAt(plan.creditTicks + 1, plan, r)).toBe("RUNNING_CAPITAL_ALLOCATION");
  });

  it("case B: global unlocks a ticket above domestic policy, and the domestic branch stops at the ticket", () => {
    const r = allocate(opportunity({ amount_cents: 670_000, term_months: 12 }), DOMESTIC, GLOBAL);
    expect(r.pool).toBe("global");
    expect(r.reason_codes).toEqual(expect.arrayContaining(["GLOBAL_EXPANDS_CAPACITY", "TICKET_OUTSIDE_POOL_POLICY"]));
    const domestic = orderedChecks(r.domestic.checks);
    expect(domestic.map((c) => c.check)).toEqual(["liquidity", "ticket", "risk_appetite", "mandate"]);
    expect(domestic.find((c) => !c.passed)?.check).toBe("ticket");
  });

  it("case C: neither pool can take it, which is a decision, not an error", () => {
    const r = allocate(opportunity({ amount_cents: 1_200_000, term_months: 12 }), DOMESTIC, GLOBAL);
    const plan = runPlan(creditSteps(opportunity()), r);
    expect(r.pool).toBeNull();
    expect(stateAt(plan.total, plan, r)).toBe("WAITING_FOR_CAPITAL");
  });

  it("a whole run lands between four and seven seconds", () => {
    const o = opportunity();
    const plan = runPlan(creditSteps(o), allocate(o, DOMESTIC, GLOBAL));
    expect(plan.total * 340).toBeGreaterThanOrEqual(4000);
    expect(plan.total * 340).toBeLessThanOrEqual(7000);
  });
});
