import { describe, expect, it } from "vitest";
import { type Mandate, mandateChecks, matchesMandate, type MandateSubject } from "./mandate";

const mandate = (over: Partial<Mandate> = {}): Mandate => ({
  investor_id: "i", kind: "impact_fund", label: "Fund", impact_mandate: false, states: [], purposes: [], sectors: [],
  risk_bands: [], pools: [], min_ticket_cents: null, max_ticket_cents: null, is_simulated: true, updated_at: "2026-09-16", ...over,
});
const opportunity = (over: Partial<MandateSubject> = {}): MandateSubject => ({
  amount_cents: 300_000, purpose: "inventory", business_sector: "food", risk_band: "LOW", funding_pool: "global",
  community_state: "PE", community_name: "Cooperativa", ...over,
});

describe("investor mandates", () => {
  it("an empty mandate sets no check and matches everything", () => {
    expect(mandateChecks(mandate(), opportunity())).toEqual([]);
    expect(matchesMandate(mandate(), opportunity())).toBe(true);
    expect(matchesMandate(null, opportunity())).toBe(true);
  });

  it("the demo impact fund: verified communities, three purposes, A or B, R$ 1,000 to R$ 6,000", () => {
    const fund = mandate({ impact_mandate: true, purposes: ["inventory", "equipment", "working_capital"], risk_bands: ["LOW", "MEDIUM"], min_ticket_cents: 100_000, max_ticket_cents: 600_000 });
    expect(matchesMandate(fund, opportunity())).toBe(true);
    expect(mandateChecks(fund, opportunity({ amount_cents: 670_000 })).filter((c) => !c.passed).map((c) => c.id)).toEqual(["ticket"]);
    expect(mandateChecks(fund, opportunity({ purpose: "renovation" })).filter((c) => !c.passed).map((c) => c.id)).toEqual(["purpose"]);
    expect(mandateChecks(fund, opportunity({ community_name: null, risk_band: "HIGH" })).filter((c) => !c.passed).map((c) => c.id)).toEqual(["impact", "risk"]);
  });

  it("geography, sector and route match exactly", () => {
    const m = mandate({ states: ["PE", "BA"], sectors: ["crafts"], pools: ["domestic"] });
    expect(mandateChecks(m, opportunity()).map((c) => [c.id, c.passed])).toEqual([["geography", true], ["sector", false], ["route", false]]);
    expect(matchesMandate(m, opportunity({ business_sector: "crafts", funding_pool: "domestic" }))).toBe(true);
    expect(matchesMandate(m, opportunity({ business_sector: "crafts", funding_pool: null }))).toBe(false);
  });
});
