import { describe, expect, it } from "vitest";
import { compareRoutes, DEFAULT_ROUTES, routeCost, type LoanTerms } from "./index";

const TERMS: LoanTerms = {
  principal_cents: 300_000, // R$ 3,000
  term_months: 6,
  required_return_bps: 1_200,
  expected_loss_bps: 500,
  operating_cost_cents: 30_000, // R$ 300 to originate and serve
};
const byId = (id: string) => DEFAULT_ROUTES.find((r) => r.id === id)!;

describe("capital routes", () => {
  it("adds up: the borrower's rate is the sum of its parts", () => {
    const c = routeCost(byId("domestic_pix"), TERMS);
    const sum = Object.values(c.components).reduce((a, b) => a + b, 0);
    expect(Math.abs(c.borrower_bps_year - sum)).toBeLessThanOrEqual(3); // rounding of each part
    expect(c.borrower_bps_month).toBe(Math.round(c.borrower_bps_year / 12));
  });

  it("works it out by hand for the domestic route", () => {
    const c = routeCost(byId("domestic_pix"), TERMS);
    // Operating: R$ 300 over R$ 3,000 for half a year = 20% a year.
    expect(c.components.operating).toBe(2_000);
    // Compliance: R$ 15 → 1% a year. Rail: two R$ 0.50 transfers → ~0.07% a year.
    expect(c.components.compliance).toBe(100);
    expect(c.components.rail).toBe(7);
    expect(c.components.hedge).toBe(0);
  });

  it("does not make blockchain cheaper by default: for reais, the domestic route wins", () => {
    const ranked = compareRoutes(TERMS);
    expect(ranked[0].route.id).toBe("domestic_pix");
    const brl = ranked.find((c) => c.route.id === "brl_stablecoin")!;
    expect(brl.borrower_bps_year).toBeGreaterThan(ranked[0].borrower_bps_year);
  });

  it("where capital crosses a border, the stablecoin beats the wire it replaces", () => {
    const wire = routeCost(byId("usd_wire"), TERMS);
    const coin = routeCost(byId("usd_stablecoin"), TERMS);
    expect(coin.borrower_bps_year).toBeLessThan(wire.borrower_bps_year);
    expect(coin.rail_cents).toBeLessThan(wire.rail_cents);
  });

  it("and the on-chain fee itself is a rounding error: the hedge is what foreign capital costs", () => {
    const coin = routeCost(byId("usd_stablecoin"), TERMS);
    const chainCents = coin.route.blockchain_cents * (TERMS.term_months + 1);
    expect(chainCents).toBeLessThan(10);
    expect(coin.components.hedge).toBeGreaterThan(coin.components.rail);
  });

  it("spreads fixed costs thinner on bigger, longer loans", () => {
    const small = routeCost(byId("domestic_pix"), TERMS);
    const big = routeCost(byId("domestic_pix"), { ...TERMS, principal_cents: 1_500_000, term_months: 12 });
    expect(big.components.operating).toBeLessThan(small.components.operating);
  });

  it("refuses a loan without principal or term", () => {
    expect(() => routeCost(byId("domestic_pix"), { ...TERMS, term_months: 0 })).toThrow();
  });
});
