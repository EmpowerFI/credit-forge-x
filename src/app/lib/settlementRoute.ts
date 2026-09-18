import {
  compareRoutes, type QuoteRequest, type RouteProvider, type RouteQuote, type RouteReason,
  type SettlementRoute, type SettlementRouteResult,
} from "@empowerfi/settlement-route";
import type { Tone } from "../components/product/StatusPill";
import { formatNumber, localized, tr } from "../i18n";
import { platform } from "./platform";

// Settlement routing, in the browser: the same comparator the database runs,
// over the same rate cards, so the engine page can price both ways to her Pix
// without writing anything. Her loan is in reais either way; what differs is
// where the exchange rate is struck, and what that leaves in her account.

export type { RouteQuote, RouteReason, SettlementRoute, SettlementRouteResult };

export const routeCardsKey = ["platform", "settlement-providers"] as const;

/** The rate cards as the database holds them: assumptions, and labelled as such wherever they show. */
export async function fetchRouteCards(): Promise<RouteProvider[]> {
  const { data, error } = await platform
    .from("settlement_providers")
    .select("route, provider, asset, fx_spread_bps, fx_struck, provider_fee_bps, provider_fee_fixed_cents, network_fee_cents, execution_eta_sec, quote_ttl_sec, min_ticket_cents, max_ticket_cents, liquidity_cents, reality, enabled, name, source_url")
    .order("route");
  if (error) throw error;
  return (data ?? []) as unknown as RouteProvider[];
}

/** A provider's name and the page it was read from, which the rate card itself does not carry. */
export type RouteCard = RouteProvider & { name: string; source_url: string | null };

/**
 * What a global allocation would raise: centavos → reais → USDC, rounded up to
 * a whole USDC, exactly as private.open_for_funding sets the funding target.
 */
export const fundingTarget = (amountCents: number, fxMilli: number) =>
  Math.ceil((amountCents * 10) / fxMilli) * 1_000_000;

/**
 * The two quotes an opportunity would be settled at, as private.settlement_requests
 * builds them: the stablecoin route carries the rate it locked at allocation and
 * the moment it locked it; the direct route is priced at today's rate, now.
 */
export function routeRequests(
  cards: RouteProvider[],
  o: { fx_brl_per_usdc_milli: number | null; allocated_at: string | null },
  todayFxMilli: number,
  now: string,
): QuoteRequest[] {
  return cards.map((provider) => provider.fx_struck === "allocation"
    ? { provider, fx_rate_milli: o.fx_brl_per_usdc_milli ?? todayFxMilli, quoted_at: o.allocated_at ?? now }
    : { provider, fx_rate_milli: todayFxMilli, quoted_at: now });
}

/** The comparison for one opportunity, run here and written nowhere. */
export function compareForOpportunity(
  cards: RouteProvider[],
  o: { amount_cents: number; funding_target_micro_usdc: number | null; fx_brl_per_usdc_milli: number | null; allocated_at: string | null },
  todayFxMilli: number,
  now = new Date().toISOString(),
): SettlementRouteResult | null {
  if (cards.length === 0) return null;
  const gross = o.funding_target_micro_usdc ?? fundingTarget(o.amount_cents, todayFxMilli);
  if (gross <= 0) return null;
  return compareRoutes({ gross_micro_usdc: gross, principal_cents: o.amount_cents, now, quotes: routeRequests(cards, o, todayFxMilli, now) });
}

/** The desk's read, from the database, before it formalises: the same answer, written nowhere. */
export async function fetchRoutePreview(opportunityId: string) {
  const { data, error } = await platform.rpc("settlement_route_preview", { p_opportunity_id: opportunityId });
  if (error) throw error;
  return data as unknown as (SettlementRouteResult & { enabled: boolean; applies: boolean }) | { enabled: boolean; applies: false };
}

/**
 * A quote as `settlement_quotes` holds it, read back beside a position: the
 * model's figures plus the provider's name and the page its card came from.
 * It has no `gross_micro_usdc` — both quotes are priced at the same gross,
 * which the decision carries once.
 */
export interface PositionRouteQuote {
  route: SettlementRoute;
  provider: string;
  name: string;
  asset: string;
  source_url: string | null;
  net_brl_cents: number;
  total_cost_cents: number;
  cost_bps: number;
  fx_rate_milli: number;
  fx_struck: "allocation" | "payout";
  fx_spread_bps: number;
  fx_cost_cents: number;
  provider_fee_cents: number;
  network_fee_cents: number;
  gross_brl_cents: number;
  gross_for_principal_micro_usdc: number;
  execution_eta_sec: number;
  quoted_at: string;
  expires_at: string;
  liquidity_ok: boolean;
  reality: string;
  hops: number;
  feasible: boolean;
  blocks: RouteReason[];
}

/** The route a position's capital took, with both quotes as they were written at disbursement. */
export interface PositionRoute {
  selected: SettlementRoute;
  reason_codes: RouteReason[];
  model_version: string;
  net_brl_delta_cents: number | null;
  compared_gross_micro_usdc: number;
  decided_at: string;
  quotes: PositionRouteQuote[];
}

export const ROUTE: Record<SettlementRoute, { label: string; short: string; says: string }> = localized({
  direct_usdc_pix: {
    label: { en: "Direct · USDC → Pix", pt: "Direta · USDC → Pix" },
    short: { en: "Direct", pt: "Direta" },
    says: {
      en: "One conversion, at the moment she is paid: the off-ramp turns USDC into reais and sends the Pix.",
      pt: "Uma conversão, no momento em que a empreendedora é paga: o off-ramp transforma USDC em reais e envia o Pix.",
    },
  },
  brl_stable_pix: {
    label: { en: "BRL stablecoin · USDC → BRS → Pix", pt: "Stablecoin de real · USDC → BRS → Pix" },
    short: { en: "BRL stablecoin", pt: "Stablecoin de real" },
    says: {
      en: "Two conversions: the reais are bought when the opportunity is allocated and held on chain, then paid out one to one, with no exchange rate at the payout.",
      pt: "Duas conversões: os reais são comprados quando a oportunidade é alocada e ficam na blockchain, depois são pagos um para um, sem câmbio no pagamento.",
    },
  },
});

/** Where the rate is struck: the difference the whole comparison is about. */
export const FX_STRUCK: Record<"allocation" | "payout", { label: string; says: string }> = localized({
  allocation: {
    label: { en: "Locked at allocation", pt: "Travado na alocação" },
    says: {
      en: "The reais were fixed when investors' capital was committed, so what she receives no longer moves with the exchange rate.",
      pt: "Os reais foram fixados quando o capital dos investidores foi comprometido, então o que a empreendedora recebe não se move mais com o câmbio.",
    },
  },
  payout: {
    label: { en: "Struck at payout", pt: "Fechado no pagamento" },
    says: {
      en: "The reais are only known when the payment is made, at that day's rate.",
      pt: "Os reais só são conhecidos na hora do pagamento, à taxa daquele dia.",
    },
  },
});

export const ROUTE_REASON: Record<RouteReason, { label: string; says: string; tone: Tone }> = localized({
  DIRECT_LOWEST_COST: {
    label: { en: "Direct costs less", pt: "A direta custa menos" },
    says: { en: "It leaves more reais in her account for the same dollars.", pt: "A rota direta deixa mais reais na conta da empreendedora pelos mesmos dólares." },
    tone: "positive",
  },
  DIRECT_FEWEST_STEPS: {
    label: { en: "Fewer conversions", pt: "Menos conversões" },
    says: {
      en: "The economics tied, so the shorter route wins: one conversion, one counterparty.",
      pt: "A economia empatou, então vence a rota mais curta: uma conversão, uma contraparte.",
    },
    tone: "info",
  },
  BRL_STABLE_BETTER_NET_BRL: {
    label: { en: "More reais to her", pt: "Mais reais para a empreendedora" },
    says: { en: "The stablecoin route delivers more for the same dollars released.", pt: "A rota da stablecoin entrega mais pelos mesmos dólares liberados." },
    tone: "positive",
  },
  BRL_STABLE_LOCKS_PRINCIPAL_EARLIER: {
    label: { en: "Principal locked earlier", pt: "Principal travado antes" },
    says: {
      en: "Its rate was struck when the opportunity was allocated, before the payout leg could move.",
      pt: "A taxa dessa rota foi fechada quando a oportunidade foi alocada, antes de a perna de pagamento se mexer.",
    },
    tone: "info",
  },
  BRL_STABLE_NO_FX_ON_PAYOUT: {
    label: { en: "No exchange rate at payout", pt: "Sem câmbio no pagamento" },
    says: { en: "The last leg is one to one: reais on chain become reais by Pix.", pt: "A última perna é um para um: reais na blockchain viram reais por Pix." },
    tone: "info",
  },
  EXTRA_CONVERSION_ADDS_COST: {
    label: { en: "The extra conversion costs more than it saves", pt: "A conversão extra custa mais do que economiza" },
    says: {
      en: "The stablecoin route could have settled this, and would have left her with less.",
      pt: "A rota da stablecoin poderia ter liquidado esta, e teria deixado menos para a empreendedora.",
    },
    tone: "caution",
  },
  ROUTE_QUOTE_EXPIRED: {
    label: { en: "Quote expired", pt: "Cotação vencida" },
    says: { en: "It was priced too long ago to be executed at that rate.", pt: "Foi cotada há tempo demais para ser executada àquela taxa." },
    tone: "caution",
  },
  ROUTE_NO_LIQUIDITY: {
    label: { en: "No liquidity for this ticket", pt: "Sem liquidez para este ticket" },
    says: { en: "The route cannot settle an amount this size right now.", pt: "A rota não consegue liquidar um valor deste tamanho agora." },
    tone: "caution",
  },
  ROUTE_TICKET_OUTSIDE_POLICY: {
    label: { en: "Ticket outside the route's range", pt: "Ticket fora da faixa da rota" },
    says: { en: "Too small or too large for what this provider settles.", pt: "Pequeno ou grande demais para o que este provedor liquida." },
    tone: "caution",
  },
  ROUTE_PROVIDER_UNAVAILABLE: {
    label: { en: "Provider unavailable", pt: "Provedor indisponível" },
    says: { en: "The route is configured but switched off.", pt: "A rota está configurada, mas desligada." },
    tone: "neutral",
  },
  NO_ROUTE_AVAILABLE: {
    label: { en: "No route available", pt: "Nenhuma rota disponível" },
    says: {
      en: "Neither way of turning these dollars into her reais can run: a decision, not an error.",
      pt: "Nenhuma das formas de transformar estes dólares nos reais da empreendedora pode rodar: uma decisão, não um erro.",
    },
    tone: "alert",
  },
});

/** How long a leg takes, read at the scale it happens. */
export const eta = (seconds: number) =>
  seconds < 3600
    ? `${formatNumber(Math.round(seconds / 60))} min`
    : tr({ en: `${formatNumber(Math.round(seconds / 360) / 10)} h`, pt: `${formatNumber(Math.round(seconds / 360) / 10)} h` });
