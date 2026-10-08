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
//   · **Nobody pays to be here.** No placement is for sale, no provider is told
//     she looked, and a product that paid for its position would make her
//     readiness into inventory — the months she reported were not given for
//     that. The real partners are pinned to the front (`featured`), at the
//     founder's decision, because they are partnerships being prospected and
//     the demo is about showing them — all of them, so the pin is a category
//     rather than a favour. That is not the same as selling the position, and
//     the difference only holds while the screen says which it is: a featured
//     card is marked as featured, and the page says the rest are ordered by
//     fit. Pinning something silently is how the first one gets sold.
//   · **Nothing here is an approval.** This says a product exists and why it
//     might suit her. Whether she gets it is the provider's decision, made
//     with its own rules, and the screen says so rather than implying a
//     outcome it cannot deliver.
//
// The matching is rules-based and each rule is readable above. It is not
// machine learning and does not claim to be.
//
// Most providers are invented for this build. The catalogue carries the shape a
// real one would — provider id, category, geography, integration status — so a
// partner can be added without reshaping anything.
//
// From 8 Oct some of them are real — **Mutav** and **Ash** — named with their
// permission, which the founder obtained and which `real.authorised` records.
// A real company in this list changes what the page may claim, so three things
// are structural rather than remembered:
//
//   · `real` carries the authorisation and the source of every factual claim
//     made about the company, so a description here is checkable rather than
//     recalled.
//   · `integration: "none"` says there is no connection to it — not a mock of
//     one. Nothing is sent, nothing is applied for, and no partnership is
//     signed; it is a company being prospected.
//   · The card and the page say which providers are invented and which are not,
//     because "the providers are invented for this prototype" stopped being
//     true the moment one of them was not.
//
// No rate, fee or approval is quoted for anyone, real or invented.

import { localized } from "../i18n";
import type { ReadinessStatus } from "./readiness";
import mutavLogo from "../../assets/provider-mutav.png";

// v0.3.0: a second real company, and a second rule that reads her sector rather
// than her months. Both real providers work that way, which is the shape of the
// truth: what opens them is what her business *is*.
export const MATCHING_MODEL_VERSION = "product-match-v0.3.0";

/** How well a product fits, worst to best. The order is the sort order. */
export type Fit = "explore" | "potential" | "ready";

export type ProductCategory = "working_capital" | "payments" | "cross_border" | "guarantee" | "wealth";

/**
 * What exists between this platform and the provider. `none` is a real company
 * with nothing built to it; `mock` is an invented provider, which cannot have
 * an integration because it cannot have anything. Neither sends anything.
 */
export type IntegrationStatus = "none" | "mock" | "sandbox" | "live";

/** A real company, named here with its permission rather than invented. */
export interface RealProvider {
  /**
   * Its own mark, bundled as an asset; absent when the company has not given
   * one, and then the card draws the same placeholder an invented provider
   * gets. Drawing a monogram instead would be inventing a mark for a real
   * company, which is the thing this field exists to avoid.
   */
  logo?: string;
  /** Who allowed the name and the mark to be used here, and when. */
  authorised: string;
  /** Where every factual claim made about it came from. */
  source: string;
  /** Its own site, for her to open if she wants to. Never opened for her. */
  site: string;
}

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
  /** Set when the provider is a real company. Absent means invented. */
  real?: RealProvider;
  /**
   * Pinned to the front of the list, ahead of fit. Nothing buys this: it marks
   * a real partnership being prospected, and the card it produces says it is
   * featured so the order stays readable. Every real provider carries it and no
   * invented one does, which is what keeps it from being a favour — a pin that
   * some real partners got and others did not would be a ranking again, just an
   * unexplained one. See the second rule in the header.
   */
  featured?: boolean;
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
    id: "rental-guarantee",
    provider_id: "mutav",
    provider: "Mutav",
    // "Fiança locatícia" is what the instrument is called in Brazil, and what
    // Mutav calls itself the issuer of — which also stops the card printing its
    // name and its category as the same two words.
    name: { en: "Rental guarantee", pt: "Fiança locatícia" },
    category: "guarantee",
    // Written from the agency's side, because that is who Mutav sells to: it
    // issues the bond to the agency, and the tenant pays the fee. An
    // entrepreneur who runs a lettings agency is its customer, not a stretch
    // from one.
    need: {
      en: "Offer your tenants a guarantee instead of asking them for a guarantor, with the reserve behind it recorded on chain.",
      pt: "Oferecer garantia aos seus inquilinos em vez de exigir fiador, com a reserva por trás dela registrada em blockchain.",
    },
    geography: ["BR"],
    integration: "none",
    featured: true,
    real: {
      logo: mutavLogo,
      authorised: "Named and marked with Mutav's permission, obtained by the founder (8 Oct 2026). No partnership is signed; the company is being prospected.",
      source: "https://www.mutav.finance/imobiliaria",
      site: "https://www.mutav.finance/imobiliaria",
    },
  },
  {
    id: "advisor-agents",
    provider_id: "ash",
    provider: "Ash",
    name: { en: "AI agents for advisors", pt: "Agentes de IA para assessoria" },
    category: "wealth",
    // Ash sells to investment advisory firms, not to their clients, so this is
    // written from the desk of whoever runs the office — the same choice the
    // guarantee's copy makes, and for the same reason.
    need: {
      en: "Put a team of agents to research, plan, execute and hold risk inside limits you set, for the portfolios your office manages.",
      pt: "Pôr uma equipe de agentes para pesquisar, planejar, executar e controlar risco dentro dos limites que você define, nas carteiras que o seu escritório administra.",
    },
    geography: ["BR"],
    integration: "none",
    featured: true,
    real: {
      // No mark: the company has not given one, so the card draws the
      // placeholder rather than something invented for it.
      authorised: "Named with Ash's permission, obtained by the founder (8 Oct 2026). No partnership is signed; the company is being prospected.",
      source: "https://pitch3.ash-web.pages.dev/pt/pitch3/",
      site: "https://pitch3.ash-web.pages.dev/pt/pitch3/",
    },
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
  /**
   * Her business sector, as the community leader typed it — free text, so this
   * is matched loosely and in either language. Only the guarantee rule reads
   * it: that product is sold through lettings agencies, so the question it
   * answers is what her business *is*, not how her months went.
   */
  sector?: string | null;
}

export type BecauseCode =
  | "ADVISORY_IS_THE_CUSTOMER"
  | "BUILT_FOR_ADVISORY_OFFICES"
  | "READY_AND_ASKED"
  | "READY_NOT_ASKED"
  | "MONTHS_BEING_RECORDED"
  | "STEADY_AND_ORGANISED"
  | "REGULARITY_OPENS_IT"
  | "SALES_ARE_LOCAL"
  | "LETTINGS_IS_THE_CUSTOMER"
  | "RUNS_THROUGH_AGENCIES";

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
  /** Pinned ahead of fit, and saying so. Mirrors `product.featured`. */
  featured?: boolean;
}

const RANK: Record<Fit, number> = { ready: 0, potential: 1, explore: 2 };

/**
 * Whether her business lets property. The sector is free text a leader types,
 * so this strips accents and looks for the words either language would use
 * rather than demanding an enum the database does not have.
 */
const plain = (sector: string | null | undefined) =>
  (sector ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const LETTINGS = /(imobili|imovei|aluguel|locac|real.?estate|letting|rental|property)/;
const letsProperty = (sector: string | null | undefined) => LETTINGS.test(plain(sector));

/** Whether her business advises other people on their money. */
const ADVISORY = /(assessoria|consultoria.?financ|escritorio.?de.?investiment|investiment|investment.?advis|wealth|gestora|corretora|patrimoni)/;
const advisesOnMoney = (sector: string | null | undefined) => ADVISORY.test(plain(sector));

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
 *     she should;
 *   · a rental guarantee is sold through lettings agencies, and advisor agents
 *     are sold to investment offices, so both ask what her business *is* rather
 *     than how her months went. They are the rules that read no component at
 *     all, which is the honest shape for a product her readiness has nothing to
 *     say about — and both of those products happen to be the real companies,
 *     because a real company sells to whoever it sells to.
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
      case "guarantee":
        // Nothing in her readiness answers this one, and pretending otherwise
        // would be the page inventing a reason. A rental guarantee is sold to
        // the agency and paid for by the tenant, so the only honest question is
        // whether her business is an agency.
        return letsProperty(input.sector)
          ? { product, fit: "ready", because: "LETTINGS_IS_THE_CUSTOMER" }
          : { product, fit: "explore", because: "RUNS_THROUGH_AGENCIES" };
      case "wealth":
        // Nothing in her readiness answers this one either. Ash sells to
        // investment advisory offices, so the question is the same shape as
        // the guarantee's: is her business one of those?
        return advisesOnMoney(input.sector)
          ? { product, fit: "ready", because: "ADVISORY_IS_THE_CUSTOMER" }
          : { product, fit: "explore", because: "BUILT_FOR_ADVISORY_OFFICES" };
      case "cross_border":
      default:
        return { product, fit: "explore", because: "SALES_ARE_LOCAL" };
    }
  });
  // Carried onto the match so the card can say it is featured, rather than the
  // screen having to reach back into the catalogue to find out why it is first.
  for (const m of out) if (m.product.featured) m.featured = true;
  // Featured first, then fit. Both halves are stable, so two featured products
  // keep their own fit order and the rest are untouched.
  return out.sort((a, b) =>
    Number(Boolean(b.product.featured)) - Number(Boolean(a.product.featured)) || RANK[a.fit] - RANK[b.fit]);
}
