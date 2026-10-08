// What her months already qualify her for, elsewhere.
//
// The product's own loop ends at one place: a P2P loan funded by investors on
// this platform. But the months she reports are evidence of a business, not
// evidence for one lender, and the readiness engine says as much in its own
// header — it is not a credit score, and "approval belongs to the financial
// partner". If that is true, then a partner is not necessarily this one, and
// the same evidence should be able to open a door somewhere else.
//
// So this matches her readiness against a catalogue of financial products and
// says, for each, whether she is ready, what makes her ready, and what is
// missing if she is not. It reads only what the readiness assessment already
// stored: the status, the four components and the missing requirements that her
// check-ins produced. There is no second score, because there is already a real
// one and inventing another beside it would be the easiest number in the
// product to doubt.
//
// Two rules hold this honest, and both are structural rather than promises:
//
//   · **She pulls; nobody pays to be here.** The catalogue is ordered by fit
//     and never by payment, there is no placement to buy, and no provider is
//     told she looked. A product that paid for its position would make her
//     readiness into inventory, and the months she reported were not given for
//     that.
//   · **Nothing here is an approval.** This says a product exists and why it
//     might suit her. Whether she gets it is the provider's decision, made
//     with its own rules, and the screen says so rather than implying a
//     outcome it cannot deliver.
//
// The matching is rules-based and each rule is readable above. It is not
// machine learning and does not claim to be.
//
// Providers are invented for this build. The catalogue carries the shape a real
// one would — provider id, category, geography, requirements, integration
// status — so a partner can be added without reshaping anything, but no real
// institution is named and no rate, fee or approval is quoted.

import { localized } from "../i18n";
import type { ReadinessStatus } from "./readiness";

export const MATCHING_MODEL_VERSION = "product-match-v0.1.0";

/** How well a product fits, worst to best. The order is the sort order. */
export type Fit = "explore" | "potential" | "ready";

export type ProductCategory = "working_capital" | "payments" | "cross_border";

/** How far a provider is from being real here. Every demo product is `mock`. */
export type IntegrationStatus = "mock" | "sandbox" | "live";

export interface FinancialProduct {
  id: string;
  provider_id: string;
  provider: string;
  name: string;
  category: ProductCategory;
  /** The need it answers, in her words rather than the provider's. */
  need: string;
  /** Where it is offered. `BR` for everything in this build. */
  geography: string[];
  integration: IntegrationStatus;
  /** Where "explore this" goes, when the platform itself can answer it. */
  to?: string;
}

/**
 * Invented providers. Named so no real institution is implied, and each one
 * says what it is rather than borrowing a real brand's shape.
 */
export const PRODUCTS: FinancialProduct[] = localized([
  {
    id: "productive-microloan",
    provider_id: "efi-p2p",
    provider: "EmpowerFI P2P",
    name: { en: "Productive microloan", pt: "Microcrédito produtivo" },
    category: "working_capital",
    need: {
      en: "Ingredients, stock and what the business needs to grow.",
      pt: "Ingredientes, estoque e o que o negócio precisa para crescer.",
    },
    geography: ["BR"],
    integration: "mock",
    to: "/app/me#capital",
  },
  {
    id: "business-payments",
    provider_id: "mock-pagaqui",
    provider: { en: "PagAqui (fictional)", pt: "PagAqui (fictícia)" },
    name: { en: "Business payments", pt: "Pagamentos do negócio" },
    category: "payments",
    need: {
      en: "Receive from customers and keep the month's transactions in one place.",
      pt: "Receber de clientes e manter as transações do mês em um lugar só.",
    },
    geography: ["BR"],
    integration: "mock",
  },
  {
    id: "cross-border-payments",
    provider_id: "mock-corredor",
    provider: { en: "Corredor (fictional)", pt: "Corredor (fictícia)" },
    name: { en: "International payments", pt: "Pagamentos internacionais" },
    category: "cross_border",
    need: {
      en: "Sell or buy outside Brazil, settled in stablecoin.",
      pt: "Vender ou comprar fora do Brasil, liquidado em stablecoin.",
    },
    geography: ["BR", "GLOBAL"],
    integration: "mock",
  },
]);

/** What the engine is given: only what the readiness assessment already stored. */
export interface MatchInput {
  status: ReadinessStatus;
  /** 0–25 each, as the readiness engine computes them. */
  components: { preparation: number; regularity: number; data_quality: number; business: number };
  /** Requirement codes the assessment is still missing. */
  missing: string[];
  /** Whether she has already asked for capital here. */
  has_request: boolean;
}

export type BecauseCode =
  | "READY_AND_ASKED"
  | "READY_NOT_ASKED"
  | "MONTHS_BEING_RECORDED"
  | "STEADY_AND_ORGANISED"
  | "REGULARITY_OPENS_IT"
  | "SALES_ARE_LOCAL";

export type GapCode = "REQUIREMENTS_OPEN" | "ONE_MORE_MONTH" | "A_FEW_MORE_MONTHS";

export interface Match {
  product: FinancialProduct;
  fit: Fit;
  /** Why this suits her, as a code the screen puts into her language. */
  because: BecauseCode;
  /** What would move it up, when something would. */
  gap?: GapCode;
  /** Requirements still open on her readiness, when the gap is those. */
  open_requirements?: number;
}

const RANK: Record<Fit, number> = { ready: 0, potential: 1, explore: 2 };

/** Consistent months, which is what a payments provider actually needs to see. */
const REGULAR = 18;
/** Months that hold together: few inconsistencies, revenue not wild. */
const ORGANISED = 18;

/**
 * Her readiness against the catalogue. Pure, with no i18n and no clock, so a
 * test can read it; every branch is a rule a person can say out loud:
 *
 *   · a productive loan needs her to be credit-ready, which is the platform's
 *     own bar and the one her assessment already answers;
 *   · a payments provider needs to see that money moves through the business
 *     regularly and that the months hold together, which is what the
 *     regularity and data-quality components measure;
 *   · cross-border needs a reason to cross a border, and a local business does
 *     not have one — so it stays something to look at, never a suggestion that
 *     she should.
 */
export function matchProducts(input: MatchInput): Match[] {
  const { status, components: c, missing } = input;
  const out: Match[] = PRODUCTS.map((product): Match => {
    switch (product.category) {
      case "working_capital":
        if (status === "CREDIT_READY") {
          return { product, fit: "ready", because: input.has_request ? "READY_AND_ASKED" : "READY_NOT_ASKED" };
        }
        return {
          product, fit: "potential", because: "MONTHS_BEING_RECORDED",
          gap: missing.length > 0 ? "REQUIREMENTS_OPEN" : "ONE_MORE_MONTH",
          open_requirements: missing.length || undefined,
        };
      case "payments": {
        const steady = c.regularity >= REGULAR && c.data_quality >= ORGANISED;
        return steady
          ? { product, fit: "ready", because: "STEADY_AND_ORGANISED" }
          : { product, fit: "potential", because: "REGULARITY_OPENS_IT", gap: "A_FEW_MORE_MONTHS" };
      }
      case "cross_border":
      default:
        return { product, fit: "explore", because: "SALES_ARE_LOCAL" };
    }
  });
  return out.sort((a, b) => RANK[a.fit] - RANK[b.fit]);
}
