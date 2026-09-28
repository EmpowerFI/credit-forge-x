import { describe, expect, it } from "vitest";
import {
  GLOBAL_CAPITAL_MODEL_VERSION,
  GLOBAL_EVIDENCE_MIN_SCORE,
  globalEconomics,
  globalEligibility,
  instalmentCommittedCents,
  recoverableDomestic,
  type GlobalGapContext,
} from "./global";
import { COST_CEILING_BPS, instalmentCents, matchCapital, type CapitalNeed, type Instrument } from "./network";
import vectors from "../vectors/global.json";

interface VectorScenario {
  name: string;
  input: GlobalGapContext;
  expect: {
    decision: string;
    reason_codes: string[];
    eligible_gap_cents: number;
    failed_gates: string[];
    economics: Record<string, number>;
  };
}

/** The global pool's own numbers: 5400 bps all-in for a twelve-month loan, of which 200 is modelled ramp. */
const base: GlobalGapContext = {
  gap_cents: 200_000, term_months: 12, max_instalment_cents: 90_000, instalment_committed_cents: 54_000,
  route_cost_bps: 5400, modelled_ramp_annual_bps: 200, quoted_mobilization_bps: 179,
  modelled_return_ramp_bps: 100, evidence_score: 18, months_reported: 12,
  settlement_feasible: true, settlement_reality: "simulated", recoverable_domestic: [],
  global_ticket_min_cents: 100_000,
};

describe("her economics once the quote replaces the constant", () => {
  it("replaces the modelled ramp rather than charging her twice for it", () => {
    const e = globalEconomics(base);
    // 5400 - 200 modelled + 279 quoted-and-modelled, not 5400 + 279.
    expect(e.total_cost_bps).toBe(base.route_cost_bps - base.modelled_ramp_annual_bps + e.mobilization_annual_bps);
    expect(e.total_cost_bps).toBeLessThan(base.route_cost_bps + e.mobilization_annual_bps);
  });

  it("costs her little on a twelve-month loan, which is the point", () => {
    const e = globalEconomics(base);
    expect(e.delta_bps).toBe(79);
    // R$ 1,40 a month on an instalment of R$ 258,07 — and R$ 3,50 on a whole R$ 5.000.
    expect(e.instalment_cents - instalmentCents(base.gap_cents, base.route_cost_bps, base.term_months)).toBe(140);
    expect(instalmentCents(500_000, e.total_cost_bps, 12) - instalmentCents(500_000, base.route_cost_bps, 12)).toBe(350);
  });

  it("costs her more the shorter the term, because one conversion is still one conversion", () => {
    const short = globalEconomics({ ...base, term_months: 3 });
    expect(short.mobilization_annual_bps).toBe(globalEconomics(base).mobilization_annual_bps * 4);
  });

  it("prices no conversion of its own", () => {
    // Both legs are given: one quoted by the comparator, one still modelled.
    const e = globalEconomics(base);
    expect(e.mobilization_total_bps).toBe(base.quoted_mobilization_bps + base.modelled_return_ramp_bps);
  });
});

describe("the gates", () => {
  it("does not call a covered need a refusal", () => {
    const r = globalEligibility({ ...base, gap_cents: 0 });
    expect(r.decision).toBe("not_needed");
    expect(r.reason_codes).toEqual(["GLOBAL_GAP_ABSENT"]);
    expect(r.eligible_gap_cents).toBe(0);
  });

  // Found by the database: with no gap there is no quote to ask for, so the
  // settlement gate had nothing to answer and was answering "no" anyway.
  it("answers no question it never asked when there is no gap", () => {
    const r = globalEligibility({ ...base, gap_cents: 0, settlement_feasible: false, evidence_score: 0, months_reported: 0 });
    expect(r.gates.map((g) => g.gate)).toEqual(["gap"]);
    expect(r.reason_codes).toEqual(["GLOBAL_GAP_ABSENT"]);
  });

  // The addendum's §17 criterion, and the reason this gate is asked before the
  // economics: money that a local route would take should not leave the country.
  it("refuses global funding for a gap a domestic route could still take", () => {
    const r = globalEligibility({ ...base, recoverable_domestic: ["credito_regional_capital_giro"] });
    expect(r.decision).toBe("refused");
    expect(r.reason_codes).toContain("GLOBAL_DOMESTIC_ROUTE_RECOVERABLE");
    expect(r.eligible_gap_cents).toBe(0);
  });

  it("asks for more reported history than a local product does", () => {
    expect(globalEligibility({ ...base, evidence_score: GLOBAL_EVIDENCE_MIN_SCORE }).decision).toBe("eligible");
    const thin = globalEligibility({ ...base, evidence_score: GLOBAL_EVIDENCE_MIN_SCORE - 1 });
    expect(thin.reason_codes).toContain("GLOBAL_EVIDENCE_INSUFFICIENT");
    // One good month is not a history, whatever its quality.
    expect(globalEligibility({ ...base, months_reported: 1 }).reason_codes).toContain("GLOBAL_EVIDENCE_INSUFFICIENT");
  });

  it("refuses a gap no regulated rail can settle now", () => {
    const r = globalEligibility({ ...base, settlement_feasible: false });
    expect(r.reason_codes).toContain("GLOBAL_NO_REGULATED_ROUTE");
    expect(r.gates.find((g) => g.gate === "regulatory_route")?.value).toBe("simulated");
  });

  it("holds the route to the same cost ceiling the network holds every route to", () => {
    const r = globalEligibility({ ...base, quoted_mobilization_bps: 7000 });
    expect(r.economics.total_cost_bps).toBeGreaterThan(COST_CEILING_BPS);
    expect(r.reason_codes).toContain("GLOBAL_COST_EXCEEDS_CEILING");
  });

  it("measures her instalment against what the domestic routes left, not against all of it", () => {
    const tight = globalEligibility({ ...base, instalment_committed_cents: 88_000 });
    expect(tight.economics.instalment_headroom_cents).toBe(2000);
    // R$ 20 a month reaches a few hundred reais of a R$ 2,000 gap, which is
    // under every global route's floor: nobody could take it, so nobody is told
    // they could.
    expect(tight.economics.affordable_gap_cents).toBeLessThan(base.global_ticket_min_cents);
    expect(tight.reason_codes).toContain("GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION");
    // The same gap, with nothing committed, fits.
    expect(globalEligibility({ ...base, instalment_committed_cents: 0 }).decision).toBe("eligible");
  });

  it("answers with an amount, so a gap she can carry half of is half a gap", () => {
    // Enough headroom for part of the R$ 2,000 gap, and well over the floor.
    const part = globalEligibility({ ...base, instalment_committed_cents: 74_000 });
    expect(part.decision).toBe("eligible");
    expect(part.economics.affordable_gap_cents).toBeGreaterThanOrEqual(base.global_ticket_min_cents);
    expect(part.economics.affordable_gap_cents).toBeLessThan(part.gap_cents);
    expect(part.eligible_gap_cents).toBe(part.economics.affordable_gap_cents);
    expect(part.reason_codes).toContain("GLOBAL_GAP_PARTLY_AFFORDABLE");
    // All of it, when her month reaches all of it.
    const whole = globalEligibility({ ...base, instalment_committed_cents: 0 });
    expect(whole.eligible_gap_cents).toBe(whole.gap_cents);
    expect(whole.reason_codes).not.toContain("GLOBAL_GAP_PARTLY_AFFORDABLE");
  });

  it("says why it said yes, not only that it did", () => {
    const r = globalEligibility(base);
    expect(r.decision).toBe("eligible");
    expect(r.reason_codes).toEqual([
      "GLOBAL_GAP_CONFIRMED", "GLOBAL_ECONOMICS_WITHIN_CEILING",
      "GLOBAL_EVIDENCE_SUFFICIENT", "GLOBAL_ROUTE_REGULATED",
    ]);
  });
});

describe("determinism", () => {
  it("gives the same answer twice", () => {
    expect(globalEligibility(base)).toEqual(globalEligibility(base));
  });

  it("refuses a gap that is not a non-negative integer", () => {
    expect(() => globalEligibility({ ...base, gap_cents: -1 })).toThrow();
    expect(() => globalEligibility({ ...base, gap_cents: 1.5 })).toThrow();
    expect(() => globalEligibility({ ...base, term_months: 0 })).toThrow();
  });
});

// What the domestic pass leaves behind, read off a real plan rather than stated.
describe("reading the domestic pass", () => {
  const regional: Instrument = {
    id: "credito_regional_capital_giro", provider: "coop_regional_demo", name: "Crédito produtivo regional",
    type: "regional_credit_product", is_credit: true, requires_partner_approval: true,
    ticket_min_cents: 100_000, ticket_max_cents: 1_500_000, eligible_uf: ["SP"],
    purposes: ["working_capital", "inventory"], business_age_min_months: 6,
    term_min_months: null, term_max_months: null,
    required_documents: ["cnpj_or_mei", "bank_statement_3m"], max_instalment_share_bps: 6000,
    estimated_cost_bps: 4800, capacity_cents: 4_000_000, impact_mandate: false, is_domestic: true, capital_scope: "regional", settlement_rail: "brl_pix",
  };
  const exchange: Instrument = {
    id: "troca_produtiva_rede", provider: "rede_troca_demo", name: "Troca produtiva em rede",
    type: "productive_exchange_network", is_credit: false, requires_partner_approval: true,
    ticket_min_cents: 10_000, ticket_max_cents: 200_000, eligible_uf: ["SP"],
    purposes: ["working_capital", "inventory"], business_age_min_months: 0,
    term_min_months: null, term_max_months: null,
    required_documents: ["network_membership"], max_instalment_share_bps: null,
    estimated_cost_bps: null, capacity_cents: 600_000, impact_mandate: false, is_domestic: true, capital_scope: "territorial", settlement_rail: "partner_card",
  };
  const need: CapitalNeed = {
    amount_cents: 500_000, term_months: 12, purpose: "inventory", uf: "SP", business_age_months: 18,
    documents: ["cnpj_or_mei", "bank_statement_3m", "network_membership"],
    max_instalment_cents: 90_000, impact_eligible: true, supplier_geography: "municipality", local_rail_available: true,
  readiness_ok: true, manual_review_allowed: false,
  };

  it("names a domestic route refused only for papers she could fetch", () => {
    const thin = { ...need, documents: ["network_membership"] };
    const plan = matchCapital(thin, [regional, exchange]);
    expect(recoverableDomestic(plan, [regional, exchange])).toEqual(["credito_regional_capital_giro"]);
  });

  it("does not call a refusal recoverable when something else also refused it", () => {
    const elsewhere = { ...need, documents: ["network_membership"], uf: "BA" };
    const plan = matchCapital(elsewhere, [regional, exchange]);
    expect(recoverableDomestic(plan, [regional, exchange])).toEqual([]);
  });

  it("sums what the credit routes of the plan already take of her month", () => {
    const plan = matchCapital(need, [regional, exchange]);
    const committed = instalmentCommittedCents(plan, [regional, exchange], need.term_months);
    // The regional route is capped at 60% of her R$900, and takes exactly that.
    expect(committed).toBe(54_000);
    // A route with no repayment takes nothing, however much of the need it covers.
    expect(plan.allocations.some((a) => a.instrument_id === exchange.id)).toBe(true);
  });

  // Found by the database, which ran a network where only the global route was
  // left: its own instalment was being charged against its own headroom.
  it("does not count the global route's own instalment against its own headroom", () => {
    const globalRoute: Instrument = {
      id: "pool_global_impacto", provider: "empowerfi_pools", name: "Pool global P2P · investidores no exterior",
      type: "global_impact_capital", is_credit: true, requires_partner_approval: false,
      ticket_min_cents: 10_000, ticket_max_cents: 5_000_000, eligible_uf: [], purposes: [],
      term_min_months: null, term_max_months: null, business_age_min_months: 0, required_documents: [], max_instalment_share_bps: 10_000,
      estimated_cost_bps: 2400, capacity_cents: 9_000_000, impact_mandate: true, is_domestic: false, capital_scope: "global", settlement_rail: "local_currency",
    };
    const plan = matchCapital(need, [globalRoute]);
    expect(plan.global_coverage_cents).toBe(need.amount_cents);
    expect(instalmentCommittedCents(plan, [globalRoute], need.term_months)).toBe(0);
  });

  it("never lets the stack commit more of her month than eligibility allowed", () => {
    const plan = matchCapital(need, [regional, exchange]);
    const committed = instalmentCommittedCents(plan, [regional, exchange], need.term_months);
    const r = globalEligibility({ ...base, gap_cents: plan.external_capital_gap_cents, instalment_committed_cents: committed });
    if (r.decision === "eligible") {
      expect(committed + r.economics.instalment_cents).toBeLessThanOrEqual(need.max_instalment_cents);
    }
  });
});

// The same expectations platform/supabase/tests/capital_global.test.sql holds
// private.global_eligibility() to.
describe("the vectors", () => {
  it("are written for this model version", () =>
    expect(vectors.model_version).toBe(GLOBAL_CAPITAL_MODEL_VERSION));

  for (const s of vectors.scenarios as VectorScenario[]) {
    it(s.name, () => {
      const r = globalEligibility(s.input);
      expect(r.decision).toBe(s.expect.decision);
      expect(r.reason_codes).toEqual(s.expect.reason_codes);
      expect(r.eligible_gap_cents).toBe(s.expect.eligible_gap_cents);
      expect(r.gates.filter((g) => !g.passed).map((g) => g.gate)).toEqual(s.expect.failed_gates);
      expect(r.economics).toEqual(s.expect.economics);
    });
  }

  it("only ever call a gap eligible when every gate passed", () => {
    for (const s of vectors.scenarios as VectorScenario[]) {
      const eligible = s.expect.decision === "eligible";
      expect(s.expect.failed_gates.length === 0).toBe(eligible);
      // An eligible gap is an amount, never more than the gap itself and never
      // less than the smallest ticket a global route would take. A gap that is
      // not eligible is nothing at all.
      if (!eligible) expect(s.expect.eligible_gap_cents).toBe(0);
      else {
        expect(s.expect.eligible_gap_cents).toBeLessThanOrEqual(s.input.gap_cents);
        expect(s.expect.eligible_gap_cents).toBeGreaterThanOrEqual(s.input.global_ticket_min_cents);
      }
    }
  });
});
