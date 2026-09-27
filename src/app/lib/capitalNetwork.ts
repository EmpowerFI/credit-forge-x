import type {
  AllocationReason,
  CapitalPlan,
  Gate,
  InstrumentAssessment,
  InstrumentType,
  NetworkReason,
} from "@empowerfi/capital-allocation";
import type { Tone } from "../components/product/StatusPill";
import { localized, tr } from "../i18n";
import { platform } from "./platform";
import type { Database } from "./platform.types";
import { REASON } from "./capital";
import { money, PURPOSE_LABEL } from "./readiness";

// The Capital Network: every instrument the network can route to, the policy
// each is offered under, and what the engine would do with one need.
//
// A business needs capital, and a loan is one of the answers rather than the
// answer. The two P2P pools are two of the instruments here; the rest are
// referral routes that produce a recommendation and a status, never a loan, an
// investment or a position. A match is never an approval.

export type Provider = Database["public"]["Tables"]["capital_providers"]["Row"];
export type Instrument = Database["public"]["Tables"]["capital_instruments"]["Row"];
export type RouteDecision = Database["public"]["Tables"]["capital_route_decisions"]["Row"];
export type ProviderType = Database["public"]["Enums"]["capital_provider_type"];

export type { CapitalPlan, Gate, InstrumentAssessment, InstrumentType, NetworkReason };

/** What one run of the engine returned, as public.run_capital_engine gives it. */
export interface EngineRun {
  decision_id: string;
  decision_no: number;
  /** False when the run reached the same answer as the last one: nothing was written. */
  recorded: boolean;
  plan: CapitalPlan;
}

export const PROVIDER_TYPE: Record<ProviderType, string> = localized({
  credit_cooperative: { en: "Credit cooperative", pt: "Cooperativa de crédito" },
  microcredit_operator: { en: "Microcredit operator", pt: "Operadora de microcrédito" },
  commercial_partner: { en: "Commercial partner", pt: "Parceiro comercial" },
  community_network: { en: "Community network", pt: "Rede comunitária" },
  sponsor_programme: { en: "Sponsored programme", pt: "Programa patrocinado" },
  p2p_pool: { en: "P2P pool", pt: "Pool P2P" },
  other: { en: "Other", pt: "Outro" },
});

/**
 * What each kind of route is, in a line a woman could read. The exchange
 * network is never described with the words "loan", "credit" or "currency": its
 * unit of account is not money, and the schema carries is_credit = false so a
 * translation cannot lose that.
 */
export const INSTRUMENT_TYPE: Record<InstrumentType, { label: string; what: string; tone: Tone }> = localized({
  regional_credit_product: {
    label: { en: "Regional credit product", pt: "Crédito produtivo regional" },
    what: { en: "A local institution's productive credit line, approved by that institution.", pt: "Linha de crédito produtivo de uma instituição local, aprovada por ela." },
    tone: "info",
  },
  microcredit: {
    label: { en: "Microcredit", pt: "Microcrédito" },
    what: { en: "Small productive tickets, usually with guidance attached and no trading history required.", pt: "Tickets produtivos pequenos, normalmente com orientação e sem exigir histórico." },
    tone: "info",
  },
  commercial_credit: {
    label: { en: "Commercial credit", pt: "Crédito comercial" },
    what: { en: "A supplier's or a commercial partner's own terms.", pt: "Condições próprias de um fornecedor ou parceiro comercial." },
    tone: "info",
  },
  productive_exchange_network: {
    label: { en: "Productive exchange in a network", pt: "Troca produtiva em rede" },
    what: { en: "Goods and services exchanged between members of a network, in the network's own unit of account. Not credit, not a currency, and not money she repays.", pt: "Bens e serviços trocados entre membros de uma rede, na unidade de conta da própria rede. Não é crédito, não é moeda e não é dinheiro que ela paga de volta." },
    tone: "caution",
  },
  sponsored_capital: {
    label: { en: "Sponsored capital", pt: "Capital patrocinado" },
    what: { en: "Capital a programme puts up for a purpose it defined.", pt: "Capital que um programa coloca para uma finalidade que ele definiu." },
    tone: "positive",
  },
  domestic_p2p: {
    label: { en: "Domestic P2P pool", pt: "Pool P2P doméstico" },
    what: { en: "Brazilian investors' capital through EmpowerFI's own desk. Its policy lives in funding_pools.", pt: "Capital de investidores brasileiros pela mesa da própria EmpowerFI. Sua política fica em funding_pools." },
    tone: "positive",
  },
  global_impact_capital: {
    label: { en: "Global impact capital", pt: "Capital global de impacto" },
    what: { en: "International capital in USDC on Solana, settled to reais. Its policy lives in funding_pools.", pt: "Capital internacional em USDC na Solana, liquidado em reais. Sua política fica em funding_pools." },
    tone: "positive",
  },
});

/** The seven gates, in the order the engine asks them. */
export const GATE: Record<Gate["gate"], { label: string; asks: string }> = localized({
  geography: {
    label: { en: "Where she is", pt: "Onde ela está" },
    asks: { en: "Does this route serve her state?", pt: "Esta rota atende o estado dela?" },
  },
  ticket: {
    label: { en: "Ticket", pt: "Ticket" },
    asks: { en: "Can this route reach its own minimum for what she asked?", pt: "Esta rota alcança o próprio mínimo para o que ela pediu?" },
  },
  purpose: {
    label: { en: "Purpose", pt: "Finalidade" },
    asks: { en: "Does this route fund what she is buying?", pt: "Esta rota financia o que ela vai comprar?" },
  },
  business_age: {
    label: { en: "Reported history", pt: "Histórico reportado" },
    asks: { en: "Has she reported for as many months as this route asks?", pt: "Ela reportou tantos meses quanto esta rota pede?" },
  },
  documents: {
    label: { en: "Papers", pt: "Documentos" },
    asks: { en: "Does she have the documents this route asks for?", pt: "Ela tem os documentos que esta rota pede?" },
  },
  affordability: {
    label: { en: "What she can pay", pt: "O que ela pode pagar" },
    asks: { en: "Does the share of her instalment this route may take reach its minimum ticket?", pt: "A parcela que esta rota pode tomar alcança o ticket mínimo dela?" },
  },
  capacity: {
    label: { en: "Capacity left", pt: "Capacidade restante" },
    asks: { en: "Has this route enough left to write its smallest ticket?", pt: "Esta rota tem o suficiente para escrever o menor ticket dela?" },
  },
});

// The reason codes the network adds. The five it shares with the pool engine
// keep the pool engine's wording — one vocabulary, so the audit console never
// shows two answers to one question.
const NETWORK_ONLY: Record<Exclude<NetworkReason, AllocationReason>, { label: string; says: string; tone: Tone }> = localized({
  PURPOSE_MATCH: {
    label: { en: "Funds this purpose", pt: "Financia esta finalidade" },
    says: { en: "This route names the purpose she is buying for, rather than funding anything productive.", pt: "Esta rota nomeia a finalidade da compra dela, em vez de financiar qualquer coisa produtiva." },
    tone: "positive",
  },
  TICKET_MATCH: {
    label: { en: "Ticket fits", pt: "Ticket cabe" },
    says: { en: "The amount this route would take is inside its ticket range.", pt: "O valor que esta rota tomaria está dentro da faixa de ticket dela." },
    tone: "positive",
  },
  REGION_MATCH: {
    label: { en: "Serves her state", pt: "Atende o estado dela" },
    says: { en: "This route states that it operates where she is.", pt: "Esta rota declara que opera onde ela está." },
    tone: "positive",
  },
  PARTNER_CAPACITY_AVAILABLE: {
    label: { en: "Capacity available", pt: "Capacidade disponível" },
    says: { en: "The provider still has capacity stated for this route.", pt: "O provedor ainda tem capacidade declarada para esta rota." },
    tone: "positive",
  },
  LOWER_ESTIMATED_COST: {
    label: { en: "Costs her least here", pt: "Custa menos para ela aqui" },
    says: { en: "Of the routes that could take this slice, this one states the lowest annual cost to her.", pt: "Entre as rotas que poderiam tomar esta fatia, esta declara o menor custo anual para ela." },
    tone: "positive",
  },
  CLOSED_NETWORK_PURPOSE_MATCH: {
    label: { en: "Inside the network's rules", pt: "Dentro das regras da rede" },
    says: { en: "What she needs is what this network exchanges between its members. No money changes hands and nothing is repaid.", pt: "O que ela precisa é o que esta rede troca entre seus membros. Nenhum dinheiro troca de mãos e nada é pago de volta." },
    tone: "caution",
  },
  SPONSORED_PROGRAM_MATCH: {
    label: { en: "Inside a programme's purpose", pt: "Dentro da finalidade de um programa" },
    says: { en: "A sponsored programme put this capital up for exactly this kind of need.", pt: "Um programa patrocinado colocou este capital exatamente para este tipo de necessidade." },
    tone: "positive",
  },
  DOMESTIC_COVERAGE_SUFFICIENT: {
    label: { en: "Local capital covers it", pt: "O capital local cobre" },
    says: { en: "Routes inside Brazil absorbed the whole request. Nothing was asked of global capital.", pt: "Rotas dentro do Brasil absorveram o pedido inteiro. Nada foi pedido ao capital global." },
    tone: "positive",
  },
  DOMESTIC_CAPACITY_PARTIAL: {
    label: { en: "Local capital covers part", pt: "O capital local cobre parte" },
    says: { en: "Routes inside Brazil took what they could; the rest is the external capital gap.", pt: "Rotas dentro do Brasil tomaram o que podiam; o resto é a lacuna de capital externo." },
    tone: "caution",
  },
  AFFORDABILITY_LIMIT: {
    label: { en: "Beyond what she can pay", pt: "Além do que ela pode pagar" },
    says: { en: "The share of her affordable instalment this route may take does not reach its smallest ticket.", pt: "A parcela que esta rota pode tomar do que ela aguenta pagar não alcança o menor ticket dela." },
    tone: "caution",
  },
  REGION_NOT_ELIGIBLE: {
    label: { en: "Does not serve her state", pt: "Não atende o estado dela" },
    says: { en: "This route states the states it serves, and hers is not one.", pt: "Esta rota declara os estados que atende, e o dela não está entre eles." },
    tone: "caution",
  },
  BUSINESS_TOO_YOUNG: {
    label: { en: "Not enough reported history", pt: "Histórico reportado insuficiente" },
    says: { en: "This route asks for more months of reported activity than she has on file.", pt: "Esta rota pede mais meses de atividade reportada do que ela tem registrados." },
    tone: "caution",
  },
  INSUFFICIENT_DOCUMENTATION: {
    label: { en: "Papers missing", pt: "Faltam documentos" },
    says: { en: "This route asks for documents she has not stated yet. It is the most fixable refusal on this list.", pt: "Esta rota pede documentos que ela ainda não declarou. É a recusa mais fácil de resolver desta lista." },
    tone: "caution",
  },
  PARTNER_CAPACITY_EXHAUSTED: {
    label: { en: "No capacity left", pt: "Sem capacidade restante" },
    says: { en: "What this route has left is less than its own smallest ticket.", pt: "O que resta nesta rota é menos do que o próprio ticket mínimo dela." },
    tone: "caution",
  },
  MANUAL_REVIEW_REQUIRED: {
    label: { en: "For a person to review", pt: "Para uma pessoa revisar" },
    says: { en: "The need did not pass the readiness and eligibility that come before this engine, so it produces a review rather than a recommendation.", pt: "A necessidade não passou pela prontidão e elegibilidade que vêm antes deste motor, então ele produz uma revisão em vez de uma recomendação." },
    tone: "alert",
  },
  NO_ROUTE_AVAILABLE: {
    label: { en: "No route available", pt: "Nenhuma rota disponível" },
    says: { en: "Nothing in the network can take this need as it stands. It is qualified demand the network does not reach.", pt: "Nada na rede consegue atender esta necessidade como ela está. É demanda qualificada que a rede não alcança." },
    tone: "alert",
  },
});

/** What a reason code says, whichever engine raised it. */
export function reasonOf(code: NetworkReason): { label: string; says: string; tone: Tone } {
  return code in REASON
    ? REASON[code as AllocationReason]
    : NETWORK_ONLY[code as Exclude<NetworkReason, AllocationReason>];
}

// ------------------------------------------------------------------- the data

export const providersKey = ["platform", "capital-providers"] as const;
export const instrumentsKey = ["platform", "capital-instruments"] as const;

export async function fetchProviders(): Promise<Provider[]> {
  const { data, error } = await platform.from("capital_providers").select("*").order("display_name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchInstruments(): Promise<Instrument[]> {
  const { data, error } = await platform.from("capital_instruments").select("*").order("code");
  if (error) throw error;
  return data ?? [];
}

/** The commercial terms an operator may change; everything else is a migration's. */
export type InstrumentPolicy = Pick<Instrument,
  | "ticket_min_cents" | "ticket_max_cents" | "eligible_uf" | "purposes" | "business_age_min_months"
  | "required_documents" | "max_instalment_share_bps" | "estimated_cost_bps" | "capacity_cents"
  | "impact_mandate" | "active">;

export async function saveInstrumentPolicy(id: string, policy: InstrumentPolicy): Promise<void> {
  const { error } = await platform.from("capital_instruments").update(policy).eq("id", id);
  if (error) throw error;
}

/**
 * Runs the engine over one opportunity and records the decision. Idempotent: a
 * run that reaches the same answer as the last one writes nothing and says so.
 */
export async function runCapitalEngine(opportunityId: string, documents: string[]): Promise<EngineRun> {
  const { data, error } = await platform.rpc("run_capital_engine", {
    p_opportunity_id: opportunityId,
    p_documents: documents,
  });
  if (error) throw error;
  return data as unknown as EngineRun;
}

export const decisionsKey = (opportunityId: string) => ["platform", "capital-route-decisions", opportunityId] as const;

export async function fetchDecisions(opportunityId: string): Promise<RouteDecision[]> {
  const { data, error } = await platform
    .from("capital_route_decisions")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("decision_no", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ----------------------------------------------------------------- the reading

/** The documents the seeded network asks for, so an operator can state them by name. */
export const DOCUMENT_LABEL: Record<string, string> = localized({
  cnpj_or_mei: { en: "CNPJ or MEI registration", pt: "CNPJ ou registro de MEI" },
  bank_statement_3m: { en: "Three months of bank statements", pt: "Três meses de extrato bancário" },
  cpf: { en: "CPF", pt: "CPF" },
  proof_of_activity: { en: "Proof of activity", pt: "Comprovante de atividade" },
  network_membership: { en: "Network membership", pt: "Filiação à rede" },
});

export const documentLabel = (code: string) => DOCUMENT_LABEL[code] ?? code;

/** Every document any active route asks for, once, in a stable order. */
export const documentsAsked = (instruments: Instrument[]): string[] =>
  [...new Set(instruments.flatMap((i) => i.required_documents))].sort();

/** A basis-point cost as a percentage a year, or the fact that there is none. */
export const costLine = (bps: number | null): string =>
  bps === null ? tr({ en: "No cost of capital", pt: "Sem custo de capital" }) : `${(bps / 100).toFixed(1)}% ${tr({ en: "a year", pt: "ao ano" })}`;

const purposeLabel = (code: string) => PURPOSE_LABEL[code as keyof typeof PURPOSE_LABEL] ?? code;

const months = (n: number) =>
  n === 0 ? tr({ en: "none", pt: "nenhum" }) : tr({ en: `${n} months`, pt: `${n} meses` });

/**
 * A gate's two sides, in the gate's own units and its own words. Both sides,
 * always: a refusal a person can check beats one she has to believe. The values
 * arrive from the engine as codes and centavos, and they are not readable until
 * they are put back into the language and the currency she uses.
 */
export function gateDetail(g: Gate): string {
  const list = (v: Gate["limit"], label: (s: string) => string) =>
    Array.isArray(v) && v.length > 0
      ? (v as (string | number)[]).map((x) => label(String(x))).join(", ")
      : tr({ en: "no restriction stated", pt: "nenhuma restrição declarada" });

  switch (g.gate) {
    case "geography":
      return tr({
        en: `she is in ${g.value}; this route serves ${list(g.limit, (x) => x)}`,
        pt: `ela está em ${g.value}; esta rota atende ${list(g.limit, (x) => x)}`,
      });
    case "ticket": {
      const [min, max] = g.limit as [number, number];
      return tr({
        en: `she asked ${money(Number(g.value))}; this route writes ${money(min)} to ${money(max)}`,
        pt: `ela pediu ${money(Number(g.value))}; esta rota escreve de ${money(min)} a ${money(max)}`,
      });
    }
    case "purpose":
      return tr({
        en: `she is buying ${purposeLabel(String(g.value))}; this route funds ${list(g.limit, purposeLabel)}`,
        pt: `ela vai comprar ${purposeLabel(String(g.value))}; esta rota financia ${list(g.limit, purposeLabel)}`,
      });
    case "business_age":
      return tr({
        en: `${months(Number(g.value))} reported; this route asks ${months(Number(g.limit))} or more`,
        pt: `${months(Number(g.value))} reportados; esta rota pede ${months(Number(g.limit))} ou mais`,
      });
    case "documents": {
      const missing = String(g.value).split(",").filter(Boolean);
      const asked = (g.limit as string[]) ?? [];
      const names = missing.map(documentLabel).join(", ");
      // Naming what this route asks for only adds something when part of it is
      // already on file; otherwise it repeats the list she is missing.
      return missing.length === asked.length
        ? tr({ en: `she has none of them on file: ${names}`, pt: `ela não tem nenhum deles no arquivo: ${names}` })
        : tr({
            en: `${names} not on file, of the ${list(g.limit, documentLabel)} this route asks for`,
            pt: `${names} fora do arquivo, dos ${list(g.limit, documentLabel)} que esta rota pede`,
          });
    }
    case "affordability":
      return tr({
        en: `${money(Number(g.value))} a month is what she can pay; the share this route may take reaches ${money(Number(g.limit))}, under its smallest ticket`,
        pt: `${money(Number(g.value))} por mês é o que ela pode pagar; a parcela que esta rota pode tomar alcança ${money(Number(g.limit))}, abaixo do menor ticket dela`,
      });
    case "capacity":
      return tr({
        en: `${money(Number(g.limit))} left; its smallest ticket is ${money(Number(g.value))}`,
        pt: `restam ${money(Number(g.limit))}; o menor ticket dela é ${money(Number(g.value))}`,
      });
  }
}
