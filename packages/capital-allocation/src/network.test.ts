import { describe, expect, it } from "vitest";
import {
  affordableAmountCents,
  CAPITAL_NETWORK_MODEL_VERSION,
  FIT_WEIGHTS,
  gates,
  type CapitalNeed,
  type Instrument,
  matchCapital,
} from "./network";
import vectors from "../vectors/network.json";

interface VectorScenario {
  name: string;
  input: {
    instruments: string[];
    overrides?: Record<string, Partial<Instrument>>;
    need: CapitalNeed;
  };
  expect: {
    status: string;
    reason_codes: string[];
    allocations: unknown[];
    domestic_coverage_cents: number;
    global_coverage_cents: number;
    unfunded_cents: number;
    external_capital_gap_cents: number;
    eligible: string[];
    fit_scores: Record<string, number>;
  };
}

// The demo network of the migration, in the engine's shape.
const regional: Instrument = {
  id: "credito_regional_capital_giro", provider: "coop_regional_demo", name: "Crédito produtivo regional",
  type: "regional_credit_product", is_credit: true, requires_partner_approval: true,
  ticket_min_cents: 100_000, ticket_max_cents: 1_500_000, eligible_uf: ["SP"],
  purposes: ["working_capital", "inventory"], business_age_min_months: 6,
  term_min_months: null, term_max_months: null,
  required_documents: ["cnpj_or_mei", "bank_statement_3m"], max_instalment_share_bps: 6000,
  estimated_cost_bps: 4800, capacity_cents: 4_000_000, impact_mandate: false, is_domestic: true,
};
const micro: Instrument = {
  id: "microcredito_produtivo", provider: "microcredito_demo", name: "Microcrédito produtivo",
  type: "microcredit", is_credit: true, requires_partner_approval: true,
  ticket_min_cents: 50_000, ticket_max_cents: 500_000, eligible_uf: ["SP", "MG"],
  purposes: ["working_capital", "inventory", "equipment"], business_age_min_months: 0,
  term_min_months: null, term_max_months: null,
  required_documents: ["cpf", "proof_of_activity"], max_instalment_share_bps: 4000,
  estimated_cost_bps: 6600, capacity_cents: 1_500_000, impact_mandate: true, is_domestic: true,
};
const exchange: Instrument = {
  id: "troca_produtiva_rede", provider: "rede_troca_demo", name: "Troca produtiva em rede",
  type: "productive_exchange_network", is_credit: false, requires_partner_approval: true,
  ticket_min_cents: 10_000, ticket_max_cents: 200_000, eligible_uf: ["SP"],
  purposes: ["working_capital", "inventory"], business_age_min_months: 0,
  term_min_months: null, term_max_months: null,
  required_documents: ["network_membership"], max_instalment_share_bps: null,
  estimated_cost_bps: null, capacity_cents: 600_000, impact_mandate: false, is_domestic: true,
};
const global: Instrument = {
  id: "pool_global_impacto", provider: "empowerfi_pools", name: "Pool global P2P · investidores no exterior",
  type: "global_impact_capital", is_credit: true, requires_partner_approval: false,
  ticket_min_cents: 10_000, ticket_max_cents: 5_000_000, eligible_uf: [],
  purposes: [], business_age_min_months: 0,
  term_min_months: null, term_max_months: null, required_documents: [],
  max_instalment_share_bps: 10_000, estimated_cost_bps: 5400, capacity_cents: 9_000_000,
  impact_mandate: true, is_domestic: false,
};
const NETWORK = [regional, micro, exchange, global];

/** Rita: R$5,000 for stock, in São Paulo, papers in order (addendum §7). */
const rita: CapitalNeed = {
  amount_cents: 500_000, term_months: 12, purpose: "inventory", uf: "SP",
  business_age_months: 18, documents: ["cnpj_or_mei", "bank_statement_3m", "cpf", "proof_of_activity", "network_membership"],
  max_instalment_cents: 90_000, impact_eligible: true, readiness_ok: true, manual_review_allowed: false,
};

describe("the fit score", () => {
  it("weights sum to one", () => {
    expect(Object.values(FIT_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("never lets a weight overturn a hard gate", () => {
    // A perfect fit in every other term, in a state the instrument does not serve.
    const plan = matchCapital({ ...rita, uf: "BA" }, [regional]);
    expect(plan.allocations).toEqual([]);
    expect(plan.reason_codes).toContain("REGION_NOT_ELIGIBLE");
  });
});

describe("the gates", () => {
  it("refuses a business younger than the product allows", () => {
    const g = gates({ ...rita, business_age_months: 2 }, regional);
    expect(g.find((x) => x.gate === "business_age")?.passed).toBe(false);
  });

  it("names the documents that are missing, not just that some are", () => {
    const g = gates({ ...rita, documents: ["cpf"] }, regional);
    const doc = g.find((x) => x.gate === "documents");
    expect(doc?.passed).toBe(false);
    expect(doc?.value).toBe("cnpj_or_mei,bank_statement_3m");
  });

  it("caps a route by what her instalment can carry", () => {
    // 40% of R$900 is R$360 a month; at 66% a year over 12 months that is well
    // under the R$5,000 she asked for.
    const affordable = affordableAmountCents(rita, micro);
    expect(affordable).toBeGreaterThan(0);
    expect(affordable).toBeLessThan(rita.amount_cents);
  });

  it("asks nothing about affordability of a route with no repayment", () => {
    expect(affordableAmountCents(rita, exchange)).toBe(Number.MAX_SAFE_INTEGER);
    expect(gates(rita, exchange).find((x) => x.gate === "affordability")?.passed).toBe(true);
  });
});

// §6's fund profile, where it touches the engine: a term range it will not go
// outside, and capital that expands what the pool's own book can reach.
describe("a fund's own policy", () => {
  const fund: Instrument = {
    id: "capital_impacto_global", provider: "fundo_impacto_global_demo", name: "Fundo de impacto internacional · capital próprio",
    type: "impact_fund_capital", is_credit: true, requires_partner_approval: true,
    ticket_min_cents: 100_000, ticket_max_cents: 5_000_000, eligible_uf: [], purposes: [],
    term_min_months: 6, term_max_months: 36, business_age_min_months: 6,
    required_documents: ["cnpj_or_mei", "bank_statement_3m"], max_instalment_share_bps: 5000,
    estimated_cost_bps: 3600, capacity_cents: 2_000_000_000, impact_mandate: true, is_domestic: false,
  };

  it("refuses a term shorter than it will fund", () => {
    const g = gates({ ...rita, term_months: 3 }, fund);
    const term = g.find((x) => x.gate === "term");
    expect(term?.passed).toBe(false);
    expect(term?.reason).toBe("TERM_OUTSIDE_POLICY");
    expect(term?.limit).toEqual([6, 36]);
  });

  it("refuses a term longer than it will fund", () => {
    expect(gates({ ...rita, term_months: 48 }, fund).find((x) => x.gate === "term")?.passed).toBe(false);
  });

  it("asks nothing about the term where no bound is stated", () => {
    expect(gates({ ...rita, term_months: 60 }, regional).find((x) => x.gate === "term")?.passed).toBe(true);
    expect(gates({ ...rita, term_months: 1 }, regional).find((x) => x.gate === "term")?.passed).toBe(true);
  });

  it("carries the fund's refusal into the plan's reasons, not into silence", () => {
    const plan = matchCapital({ ...rita, term_months: 3 }, [{ ...regional, capacity_cents: 0 }, fund]);
    expect(plan.status).toBe("no_route");
    expect(plan.reason_codes).toContain("TERM_OUTSIDE_POLICY");
  });

  it("expands what the pools could reach rather than competing with them", () => {
    const plan = matchCapital(rita, [{ ...regional, capacity_cents: 200_000 }, { ...global, capacity_cents: 0 }, fund]);
    const mine = plan.allocations.find((a) => a.instrument_id === fund.id);
    expect(mine?.amount_cents).toBe(300_000);
    expect(mine?.reasons).toContain("GLOBAL_EXPANDS_CAPACITY");
    // A third party's capital still needs that third party to say yes.
    expect(mine?.requires_partner_approval).toBe(true);
  });
});

describe("the capital stack", () => {
  it("combines more than one instrument for one need", () => {
    const plan = matchCapital(rita, NETWORK);
    expect(plan.allocations.length).toBeGreaterThan(1);
    expect(plan.model_version).toBe(CAPITAL_NETWORK_MODEL_VERSION);
  });

  it("never allocates more than she asked for", () => {
    const plan = matchCapital(rita, NETWORK);
    const total = plan.allocations.reduce((n, a) => n + a.amount_cents, 0);
    expect(total).toBeLessThanOrEqual(rita.amount_cents);
    expect(plan.domestic_coverage_cents + plan.global_coverage_cents).toBe(total);
  });

  it("accounts for every centavo she asked for", () => {
    const plan = matchCapital(rita, NETWORK);
    expect(plan.domestic_coverage_cents + plan.global_coverage_cents + plan.unfunded_cents)
      .toBe(plan.requested_cents);
  });

  it("offers the global route only the residual domestic could not absorb", () => {
    const plan = matchCapital(rita, NETWORK);
    expect(plan.external_capital_gap_cents).toBe(plan.requested_cents - plan.domestic_coverage_cents);
    expect(plan.global_coverage_cents).toBeLessThanOrEqual(plan.external_capital_gap_cents);
  });

  it("exposes a gap when domestic capacity runs out, and lets global expand it", () => {
    // Every domestic route thinned at once: the exchange alone would otherwise
    // absorb the residual, which is §7's own example and is tested above.
    const thin = [
      { ...regional, capacity_cents: 300_000 },
      { ...micro, capacity_cents: 0 },
      { ...exchange, capacity_cents: 50_000 },
      global,
    ];
    const plan = matchCapital(rita, thin);
    expect(plan.external_capital_gap_cents).toBeGreaterThan(0);
    expect(plan.global_coverage_cents).toBeGreaterThan(0);
    expect(plan.reason_codes).toContain("GLOBAL_EXPANDS_CAPACITY");
    expect(plan.reason_codes).toContain("DOMESTIC_CAPACITY_PARTIAL");
  });

  it("leaves demand unfunded rather than inventing a route", () => {
    const plan = matchCapital(rita, [{ ...regional, capacity_cents: 200_000 }]);
    expect(plan.unfunded_cents).toBeGreaterThan(0);
    expect(plan.status).toBe("recommended");
  });

  it("says no route at all when the network has none", () => {
    const plan = matchCapital({ ...rita, uf: "AC" }, [regional, exchange]);
    expect(plan.status).toBe("no_route");
    expect(plan.reason_codes).toContain("NO_ROUTE_AVAILABLE");
  });
});

describe("the guardrails", () => {
  it("marks the exchange route as not credit wherever it is recommended", () => {
    const plan = matchCapital({ ...rita, amount_cents: 150_000, max_instalment_cents: 0 }, NETWORK);
    const ex = plan.allocations.find((a) => a.instrument_id === exchange.id);
    expect(ex).toBeDefined();
    expect(ex?.is_credit).toBe(false);
    expect(ex?.reasons).toContain("CLOSED_NETWORK_PURPOSE_MATCH");
  });

  it("carries partner approval on every route whose owner must still say yes", () => {
    const plan = matchCapital(rita, NETWORK);
    for (const a of plan.allocations) {
      const i = NETWORK.find((x) => x.id === a.instrument_id)!;
      expect(a.requires_partner_approval).toBe(i.requires_partner_approval);
    }
  });

  it("asks for a review rather than a plan when readiness did not pass", () => {
    const plan = matchCapital({ ...rita, readiness_ok: false }, NETWORK);
    expect(plan.status).toBe("manual_review");
    expect(plan.allocations).toEqual([]);
    expect(plan.reason_codes).toEqual(["MANUAL_REVIEW_REQUIRED"]);
  });
});

describe("determinism", () => {
  it("gives the same plan twice", () => {
    expect(matchCapital(rita, NETWORK)).toEqual(matchCapital(rita, NETWORK));
  });

  it("does not depend on the order the network is listed in", () => {
    const a = matchCapital(rita, NETWORK);
    const b = matchCapital(rita, [...NETWORK].reverse());
    expect(b.allocations).toEqual(a.allocations);
    expect(b.domestic_coverage_cents).toBe(a.domestic_coverage_cents);
  });

  it("refuses an amount that is not a positive integer", () => {
    expect(() => matchCapital({ ...rita, amount_cents: 0 }, NETWORK)).toThrow();
    expect(() => matchCapital({ ...rita, amount_cents: 1.5 }, NETWORK)).toThrow();
  });
});

// The same expectations platform/supabase/tests/capital_network.test.sql holds
// private.match_capital() to. A plan that differs between the browser and the
// database is one of them being wrong, and neither is allowed to be.
describe("the vectors", () => {
  const byId = new Map(vectors.instruments.map((i) => [i.id, i as Instrument]));

  it("are written for this model version", () =>
    expect(vectors.model_version).toBe(CAPITAL_NETWORK_MODEL_VERSION));

  for (const s of vectors.scenarios as VectorScenario[]) {
    it(s.name, () => {
      const set = s.input.instruments.map((id) => {
        const base = byId.get(id);
        if (!base) throw new Error(`unknown instrument ${id}`);
        return { ...base, ...(s.input.overrides?.[id] ?? {}) };
      });
      const plan = matchCapital(s.input.need, set);
      expect(plan.status).toBe(s.expect.status);
      expect(plan.reason_codes).toEqual(s.expect.reason_codes);
      expect(plan.allocations).toEqual(s.expect.allocations);
      expect(plan.domestic_coverage_cents).toBe(s.expect.domestic_coverage_cents);
      expect(plan.global_coverage_cents).toBe(s.expect.global_coverage_cents);
      expect(plan.unfunded_cents).toBe(s.expect.unfunded_cents);
      expect(plan.external_capital_gap_cents).toBe(s.expect.external_capital_gap_cents);
      expect(plan.evaluated.filter((e) => e.eligible).map((e) => e.instrument_id)).toEqual(s.expect.eligible);
      expect(Object.fromEntries(plan.evaluated.map((e) => [e.instrument_id, e.fit_score]))).toEqual(s.expect.fit_scores);
    });
  }

  it("keep every centavo of the need accounted for", () => {
    for (const s of vectors.scenarios as VectorScenario[]) {
      const e = s.expect;
      expect(e.domestic_coverage_cents + e.global_coverage_cents + e.unfunded_cents).toBe(s.input.need.amount_cents);
      // The gap measures the domestic network, taken before global money hides it.
      expect(e.external_capital_gap_cents).toBe(s.input.need.amount_cents - e.domestic_coverage_cents);
    }
  });
});
