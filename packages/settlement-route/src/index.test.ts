// @vitest-environment node
import { describe, expect, it } from "vitest";
import { usdcToCents } from "@empowerfi/capital-allocation";
import vectors from "../vectors/scenarios.json";
import {
  centsFromMicroUsdc, compareRoutes, grossForCents, netCents, quote, ROUTE_HOPS,
  SETTLEMENT_ROUTE_MODEL_VERSION, type QuoteRequest, type RouteProvider, type SettlementRoute, type SettlementRouteResult,
} from "./index.ts";

// Expectations in vectors/scenarios.json were reasoned from the rules by hand.
// The database's private.settle_route is held to the same scenarios.

const DIRECT = vectors.providers.direct as RouteProvider;
const STABLE = vectors.providers.brl_stable as RouteProvider;
const BASE = vectors.base;

type Scenario = (typeof vectors.scenarios)[number] & {
  input: {
    gross_micro_usdc?: number;
    principal_cents?: number;
    now?: string;
    direct?: Partial<RouteProvider>;
    brl_stable?: Partial<RouteProvider>;
    direct_fx_rate_milli?: number;
    brl_stable_fx_rate_milli?: number;
    direct_quoted_at?: string;
    brl_stable_quoted_at?: string;
  };
};

const requests = (s: Scenario): QuoteRequest[] => [
  {
    provider: { ...DIRECT, ...s.input.direct },
    fx_rate_milli: s.input.direct_fx_rate_milli ?? BASE.direct_fx_rate_milli,
    quoted_at: s.input.direct_quoted_at ?? BASE.direct_quoted_at,
  },
  {
    provider: { ...STABLE, ...s.input.brl_stable },
    fx_rate_milli: s.input.brl_stable_fx_rate_milli ?? BASE.brl_stable_fx_rate_milli,
    quoted_at: s.input.brl_stable_quoted_at ?? BASE.brl_stable_quoted_at,
  },
];

const run = (s: Scenario): SettlementRouteResult =>
  compareRoutes({
    gross_micro_usdc: s.input.gross_micro_usdc ?? BASE.gross_micro_usdc,
    principal_cents: s.input.principal_cents ?? null,
    now: s.input.now ?? BASE.now,
    quotes: requests(s),
  });

const of = (r: SettlementRouteResult, route: SettlementRoute) => r.quotes.find((q) => q.route === route)!;
const scenarios = vectors.scenarios as Scenario[];

describe("scenarios", () => {
  it("are written for this model version", () => expect(vectors.model_version).toBe(SETTLEMENT_ROUTE_MODEL_VERSION));

  for (const s of scenarios) {
    it(s.name, () => {
      const r = run(s);
      const e = s.expect as Record<string, unknown>;
      expect(r.selected, "selected").toBe(e.selected ?? null);
      expect(r.reason_codes, "reason codes").toEqual(e.reason_codes);
      expect(r.net_brl_delta_cents, "net delta").toBe(e.net_brl_delta_cents ?? null);
      if ("direct_net_brl_cents" in e) expect(of(r, "direct_usdc_pix").net_brl_cents, "direct net").toBe(e.direct_net_brl_cents);
      if ("brl_stable_net_brl_cents" in e) expect(of(r, "brl_stable_pix").net_brl_cents, "stable net").toBe(e.brl_stable_net_brl_cents);
      if ("direct_cost_bps" in e) expect(of(r, "direct_usdc_pix").cost_bps, "direct cost bps").toBe(e.direct_cost_bps);
      if ("brl_stable_cost_bps" in e) expect(of(r, "brl_stable_pix").cost_bps, "stable cost bps").toBe(e.brl_stable_cost_bps);
      if ("direct_feasible" in e) expect(of(r, "direct_usdc_pix").feasible, "direct feasible").toBe(e.direct_feasible);
      if ("brl_stable_feasible" in e) expect(of(r, "brl_stable_pix").feasible, "stable feasible").toBe(e.brl_stable_feasible);
      if ("gross_for_principal" in e) expect(r.gross_for_principal, "gross for her principal").toEqual(e.gross_for_principal);
    });
  }
});

describe("properties", () => {
  it("only ever selects a route that can settle the ticket", () => {
    for (const s of scenarios) {
      const r = run(s);
      if (r.selected) expect(of(r, r.selected).feasible, s.name).toBe(true);
      else expect(r.quotes.some((q) => q.feasible), s.name).toBe(false);
    }
  });

  it("never selects the route that delivers her fewer reais", () => {
    for (const s of scenarios) {
      const r = run(s);
      if (!r.selected) continue;
      const best = Math.max(...r.quotes.filter((q) => q.feasible).map((q) => q.net_brl_cents));
      expect(of(r, r.selected).net_brl_cents, s.name).toBe(best);
    }
  });

  it("gives every result at least one reason, with no repeats", () => {
    for (const s of scenarios) {
      const codes = run(s).reason_codes;
      expect(codes.length, s.name).toBeGreaterThan(0);
      expect(new Set(codes).size, s.name).toBe(codes.length);
    }
  });

  it("prices both routes at the same gross, whichever it selects", () => {
    for (const s of scenarios) {
      const r = run(s);
      for (const q of r.quotes) expect(q.gross_micro_usdc, s.name).toBe(r.compared_gross_micro_usdc);
    }
  });

  it("never claims a stablecoin route is real", () => {
    for (const s of scenarios) {
      for (const q of run(s).quotes) {
        if (q.asset === "BRS") expect(q.reality, s.name).toBe("simulated");
      }
    }
  });

  it("takes the extra conversion only when it pays for itself", () => {
    for (const s of scenarios) {
      const r = run(s);
      if (r.selected !== "brl_stable_pix") continue;
      const direct = of(r, "direct_usdc_pix");
      expect(direct.feasible === false || of(r, "brl_stable_pix").net_brl_cents > direct.net_brl_cents, s.name).toBe(true);
    }
  });
});

describe("the reais a gross becomes", () => {
  it("rounds as the capital allocation engine does, so a loan priced there settles here", () => {
    for (const micro of [0, 1, 999_999, 1_000_000, 100_000_000, 6_000_000_000]) {
      for (const fx of [4800, 5180, 5400, 5999]) {
        expect(centsFromMicroUsdc(micro, fx)).toBe(usdcToCents(micro, fx));
      }
    }
  });

  it("never falls as the gross rises", () => {
    let last = -1;
    for (let micro = 0; micro <= 2_000_000; micro += 7919) {
      const net = netCents(micro, 5400, DIRECT);
      expect(net).toBeGreaterThanOrEqual(last);
      last = net;
    }
  });

  it("charges the spread, the fee and the network cost, and nothing else", () => {
    const q = quote({ provider: DIRECT, fx_rate_milli: 5400, quoted_at: BASE.direct_quoted_at }, 100_000_000, BASE.now);
    expect(q.gross_brl_cents).toBe(54_000);
    expect(q.fx_cost_cents + q.provider_fee_cents + q.network_fee_cents).toBe(q.total_cost_cents);
    expect(q.gross_brl_cents - q.total_cost_cents).toBe(q.net_brl_cents);
    expect(q.expires_at).toBe("2026-09-18T12:08:00.000Z");
    expect(q.hops).toBe(ROUTE_HOPS.direct_usdc_pix);
  });
});

describe("the gross her principal needs", () => {
  const principals = [10_000, 150_000, 480_000, 1_000_000];

  it("delivers at least the principal, and is the smallest gross that does", () => {
    for (const provider of [DIRECT, STABLE]) {
      for (const cents of principals) {
        const gross = grossForCents(cents, 5400, provider)!;
        expect(netCents(gross, 5400, provider), `${provider.provider} ${cents}`).toBeGreaterThanOrEqual(cents);
        expect(netCents(gross - 1, 5400, provider), `${provider.provider} ${cents} minimal`).toBeLessThan(cents);
      }
    }
  });

  it("asks for more dollars on the dearer route", () => {
    for (const cents of principals) {
      expect(grossForCents(cents, 5400, STABLE)!).toBeGreaterThan(grossForCents(cents, 5400, DIRECT)!);
    }
  });

  it("leaves her principal whole and asks the vault for the difference", () => {
    const r = run(scenarios.find((s) => s.input.principal_cents)!);
    expect(r.principal_cents).toBe(150_000);
    for (const route of ["direct_usdc_pix", "brl_stable_pix"] as SettlementRoute[]) {
      const gross = r.gross_for_principal[route]!;
      const provider = route === "direct_usdc_pix" ? DIRECT : STABLE;
      expect(netCents(gross, 5400, provider), route).toBeGreaterThanOrEqual(150_000);
    }
  });

  it("shows what locking the rate earlier is worth, in dollars, on the same principal", () => {
    const moved = run(scenarios.find((s) => s.name.startsWith("B ·"))!);
    // The payout leg's rate moved; the locked route needs fewer dollars for the same reais.
    expect(moved.gross_for_principal.brl_stable_pix!).toBeLessThan(moved.gross_for_principal.direct_usdc_pix!);
  });
});

describe("refusals", () => {
  const ok = { now: BASE.now, quotes: requests({ input: {} } as Scenario) };
  it("refuses a gross that is not a positive integer", () => {
    expect(() => compareRoutes({ ...ok, gross_micro_usdc: 0 })).toThrow(/positive integer/);
    expect(() => compareRoutes({ ...ok, gross_micro_usdc: 1.5 })).toThrow(/positive integer/);
  });
  it("refuses a moment it cannot read", () => {
    expect(() => compareRoutes({ ...ok, gross_micro_usdc: 100_000_000, now: "not a date" })).toThrow(/ISO 8601/);
  });
});
