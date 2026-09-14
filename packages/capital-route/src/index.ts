// Capital routes: what a loan costs the borrower depending on how the capital
// reaches her. A simulator, not a quote — every figure below is an assumption
// the screen shows and lets the viewer change.
//
// The point it exists to make honestly: a blockchain rail is not cheaper by
// default. For capital already in reais, the domestic route through a partner
// and Pix is the cheapest. A stablecoin earns its place where capital crosses
// a border, against the bank wire it replaces — and even there the currency
// hedge, not the rail, is most of the difference to a domestic loan.
//
// Rates are basis points a year; amounts are centavos. Pure and deterministic.

export const CAPITAL_ROUTE_MODEL_VERSION = "capital-route-v0.1.0";

export type RouteId = "domestic_pix" | "brl_stablecoin" | "usd_wire" | "usd_stablecoin";

export interface Route {
  id: RouteId;
  capital_source: string;
  currency: "BRL" | "USD";
  rail: string;
  /** Currency conversion spread, each way. */
  fx_bps: number;
  /** On- and off-ramp spread between a stablecoin and reais, each way. */
  ramp_bps: number;
  /** Tax on the inbound conversion — an assumption, to be validated legally. */
  inbound_tax_bps: number;
  /** Cost of hedging foreign capital against the real, a year. */
  hedge_bps_year: number;
  /** Per transfer: bank or network fees, shared across a batch of loans. */
  transfer_cents: number;
  /** Per transaction on chain (disbursement and each instalment). */
  blockchain_cents: number;
  /** Compliance per loan: KYC/KYT, cross-border reporting. */
  compliance_cents: number;
}

/** Illustrative defaults. Every one is an assumption, shown and editable. */
export const DEFAULT_ROUTES: Route[] = [
  {
    id: "domestic_pix", capital_source: "Brazilian investor", currency: "BRL", rail: "Bank transfer → partner → Pix",
    fx_bps: 0, ramp_bps: 0, inbound_tax_bps: 0, hedge_bps_year: 0,
    transfer_cents: 50, blockchain_cents: 0, compliance_cents: 1_500,
  },
  {
    id: "brl_stablecoin", capital_source: "Brazilian investor", currency: "BRL", rail: "BRL stablecoin → off-ramp → Pix",
    fx_bps: 0, ramp_bps: 50, inbound_tax_bps: 0, hedge_bps_year: 0,
    transfer_cents: 50, blockchain_cents: 1, compliance_cents: 2_500,
  },
  {
    id: "usd_wire", capital_source: "Foreign investor", currency: "USD", rail: "USD wire → bank FX → partner → Pix",
    fx_bps: 150, ramp_bps: 0, inbound_tax_bps: 38, hedge_bps_year: 800,
    transfer_cents: 300, blockchain_cents: 0, compliance_cents: 4_000,
  },
  {
    id: "usd_stablecoin", capital_source: "Foreign investor", currency: "USD", rail: "USDC → regulated off-ramp → Pix",
    fx_bps: 60, ramp_bps: 50, inbound_tax_bps: 38, hedge_bps_year: 800,
    transfer_cents: 50, blockchain_cents: 1, compliance_cents: 4_000,
  },
];

export interface LoanTerms {
  principal_cents: number;
  term_months: number;
  /** What the capital asks, a year, in its own currency. */
  required_return_bps: number;
  /** Expected loss, a year. */
  expected_loss_bps: number;
  /** EmpowerFI's and the partner's cost to originate and serve the loan. */
  operating_cost_cents: number;
}

export interface RouteCost {
  route: Route;
  /** Each component as basis points of principal, a year. */
  components: { capital: number; hedge: number; expected_loss: number; operating: number; rail: number; compliance: number };
  /** The rate the borrower pays, a year and a month. */
  borrower_bps_year: number;
  borrower_bps_month: number;
  /** Rail and compliance only, in centavos over the loan's life. */
  rail_cents: number;
}

/** Centavos over the loan's life → basis points of principal a year. */
const perYear = (cents: number, t: LoanTerms) => (cents * 10_000 * 12) / (t.principal_cents * t.term_months);

export function routeCost(route: Route, terms: LoanTerms): RouteCost {
  if (terms.principal_cents <= 0 || terms.term_months <= 0) throw new Error("principal and term must be positive");
  // In: conversion, ramp and tax on the way to her. Out: conversion and ramp
  // on the way back, as instalments return to the capital.
  const inbound = route.fx_bps + route.ramp_bps + route.inbound_tax_bps;
  const outbound = route.fx_bps + route.ramp_bps;
  const spreadCents = (terms.principal_cents * (inbound + outbound)) / 10_000;
  const feesCents = route.transfer_cents * 2 + route.blockchain_cents * (terms.term_months + 1);
  const rail = perYear(spreadCents + feesCents, terms);
  const compliance = perYear(route.compliance_cents, terms);
  const components = {
    capital: terms.required_return_bps,
    hedge: route.hedge_bps_year,
    expected_loss: terms.expected_loss_bps,
    operating: perYear(terms.operating_cost_cents, terms),
    rail,
    compliance,
  };
  const year = Object.values(components).reduce((a, b) => a + b, 0);
  return {
    route,
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, Math.round(v)])) as RouteCost["components"],
    borrower_bps_year: Math.round(year),
    borrower_bps_month: Math.round(year / 12),
    rail_cents: Math.round(spreadCents + feesCents + route.compliance_cents),
  };
}

/** Every route, cheapest for the borrower first. */
export function compareRoutes(terms: LoanTerms, routes: Route[] = DEFAULT_ROUTES): RouteCost[] {
  return routes.map((r) => routeCost(r, terms)).sort((a, b) => a.borrower_bps_year - b.borrower_bps_year);
}
