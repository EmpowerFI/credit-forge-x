import type {
  AllocationReason,
  CapitalPlan,
  Gate,
  GlobalEligibility,
  GlobalGate,
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

export type { CapitalPlan, Gate, GlobalEligibility, GlobalGate, InstrumentAssessment, InstrumentType, NetworkReason };

/**
 * What a route card needs to name an instrument. public.capital_plan() returns
 * exactly this for the instruments one decision mentions, and no more: an
 * entrepreneur is shown the routes recommended for her, never the policy of
 * every provider in the network. The registry row satisfies it, so one
 * component renders a stored plan and a fresh run.
 */
export interface RouteInstrument {
  code: string;
  name: string;
  instrument_type: InstrumentType;
  is_domestic: boolean;
  is_credit: boolean;
}

/** One stored decision, as public.capital_plan() returns it. Null where the engine has not run. */
export interface StoredPlan {
  decision_id: string;
  decision_no: number;
  decided_at: string;
  is_simulated: boolean;
  /** code → policy_version of every instrument the run evaluated. */
  instrument_policy: Record<string, number>;
  plan: CapitalPlan;
  /**
   * Whether international capital may take what local capital left, and why
   * either way. Null on a decision recorded before the question existed, which
   * a screen reads as "not asked", never as "refused".
   */
  global_eligibility: GlobalEligibility | null;
  instruments: RouteInstrument[];
}

/** What one run of the engine returned, as public.run_capital_engine gives it. */
export interface EngineRun {
  decision_id: string;
  decision_no: number;
  /** False when the run reached the same answer as the last one: nothing was written. */
  recorded: boolean;
  plan: CapitalPlan;
  global_eligibility: GlobalEligibility;
}

export const PROVIDER_TYPE: Record<ProviderType, string> = localized({
  credit_cooperative: { en: "Credit cooperative", pt: "Cooperativa de crédito" },
  microcredit_operator: { en: "Microcredit operator", pt: "Operadora de microcrédito" },
  commercial_partner: { en: "Commercial partner", pt: "Parceiro comercial" },
  community_network: { en: "Community network", pt: "Rede comunitária" },
  sponsor_programme: { en: "Sponsored programme", pt: "Programa patrocinado" },
  p2p_pool: { en: "P2P pool", pt: "Pool P2P" },
  impact_fund: { en: "Impact fund", pt: "Fundo de impacto" },
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
    what: { en: "People in Brazil lending through EmpowerFI's own desk. She receives and repays in reais, by Pix.", pt: "Pessoas no Brasil emprestando pela mesa da própria EmpowerFI. Ela recebe e paga em reais, por Pix." },
    tone: "positive",
  },
  // The two routes from abroad, told apart. Many lenders with no veto, against
  // one lender with a mandate: that difference is what "capital from outside
  // Brazil" actually means here, and it belongs on the card.
  global_impact_capital: {
    label: { en: "Investors abroad, share by share", pt: "Investidores no exterior, cota a cota" },
    what: { en: "People and funds outside Brazil each funding a share of one loan, in USDC on Solana or in shielded ZEC. Nobody has to approve it: the raise closes when enough of them have said yes. She receives and repays in reais, and never touches a token.", pt: "Pessoas e fundos fora do Brasil financiando cada um uma cota de um mesmo empréstimo, em USDC na Solana ou em ZEC blindado. Ninguém precisa aprovar: a captação fecha quando gente suficiente disse sim. Ela recebe e paga em reais, e nunca encosta em um token." },
    tone: "positive",
  },
  impact_fund_capital: {
    label: { en: "One fund, on its own mandate", pt: "Um fundo, com mandato próprio" },
    what: { en: "A single fund outside Brazil lending from its own balance sheet, on terms and a mandate it wrote. It has to say yes, and it asks for reports back. She receives and repays in reais.", pt: "Um único fundo fora do Brasil emprestando do próprio balanço, em condições e mandato que ele escreveu. Ele precisa dizer sim, e pede relatórios de volta. Ela recebe e paga em reais." },
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
  term: {
    label: { en: "Term", pt: "Prazo" },
    asks: { en: "Is the number of months she needs inside what this route will fund?", pt: "O número de meses que ela precisa está dentro do que esta rota financia?" },
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
  AFFORDABILITY_BUDGET_SHARED: {
    label: { en: "Sized against the rest of the plan", pt: "Dimensionada junto com o resto do plano" },
    says: {
      en: "This route took less than its own policy allowed, because the other routes in this plan had already taken part of what she can repay each month. Each slice fits on its own; the plan has to fit too.",
      pt: "Esta rota tomou menos do que a política dela permitia, porque as outras rotas deste plano já tinham tomado parte do que ela consegue pagar por mês. Cada fatia cabe sozinha; o plano também precisa caber.",
    },
    tone: "caution",
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
  TERM_OUTSIDE_POLICY: {
    label: { en: "Term outside this route", pt: "Prazo fora desta rota" },
    says: { en: "This route funds a range of terms, and the number of months she needs is outside it.", pt: "Esta rota financia uma faixa de prazos, e o número de meses que ela precisa está fora dela." },
    tone: "caution",
  },
  // The second question, asked of the residual gap. A gap refused for global
  // funding is a decision someone has to be able to read, so each of these says
  // what happened rather than naming the gate that happened.
  GLOBAL_GAP_CONFIRMED: {
    label: { en: "Local capital left a gap", pt: "O capital local deixou uma lacuna" },
    says: { en: "Routes inside Brazil could not absorb the whole request, so international capital was asked about the rest.", pt: "Rotas dentro do Brasil não absorveram o pedido inteiro, então o capital internacional foi perguntado sobre o resto." },
    tone: "caution",
  },
  GLOBAL_ECONOMICS_WITHIN_CEILING: {
    label: { en: "Cost stays under the ceiling", pt: "O custo fica abaixo do teto" },
    says: { en: "Her all-in cost through this route, with what it really costs to bring the money in, is inside what the engine allows and inside what her month has left.", pt: "O custo total para ela por esta rota, com o que custa de verdade trazer o dinheiro, está dentro do que o motor permite e dentro do que sobra no mês dela." },
    tone: "positive",
  },
  GLOBAL_GAP_PARTLY_AFFORDABLE: {
    label: { en: "Part of the gap, not all of it", pt: "Parte da lacuna, não toda ela" },
    says: {
      en: "At the price a rail actually quoted, her month reaches some of what local capital could not — so that much of the gap is what capital from outside Brazil may take, and the rest waits.",
      pt: "Ao preço que um trilho de fato cotou, o mês dela alcança parte do que o capital local não alcançou — então essa parte é o que o capital de fora do Brasil pode tomar, e o resto espera.",
    },
    tone: "caution",
  },
  GLOBAL_EVIDENCE_SUFFICIENT: {
    label: { en: "Enough reported history", pt: "Histórico reportado suficiente" },
    says: { en: "Money that crosses a border is reported on to people who will never meet her, and the history behind this request carries that.", pt: "Dinheiro que cruza uma fronteira é reportado a pessoas que nunca vão conhecê-la, e o histórico por trás deste pedido sustenta isso." },
    tone: "positive",
  },
  GLOBAL_ROUTE_REGULATED: {
    label: { en: "A regulated rail can settle it", pt: "Um trilho regulado consegue liquidar" },
    says: { en: "A route exists today that can turn this amount into reais in her account, and the comparator priced it.", pt: "Existe hoje uma rota que consegue transformar este valor em reais na conta dela, e o comparador precificou." },
    tone: "positive",
  },
  GLOBAL_GAP_ABSENT: {
    label: { en: "Nothing left for global capital", pt: "Nada sobrou para o capital global" },
    says: { en: "Local capital covered her whole request, so the question of international money was never asked. That is not a refusal.", pt: "O capital local cobriu o pedido inteiro dela, então a pergunta sobre dinheiro internacional nunca foi feita. Isso não é uma recusa." },
    tone: "positive",
  },
  GLOBAL_DOMESTIC_ROUTE_RECOVERABLE: {
    label: { en: "A local route could still take it", pt: "Uma rota local ainda pode assumir" },
    says: { en: "A route inside Brazil refused this only for papers she could fetch. Demand a local route would take does not go abroad.", pt: "Uma rota dentro do Brasil recusou isto só por documentos que ela pode buscar. Demanda que uma rota local assumiria não vai para o exterior." },
    tone: "caution",
  },
  GLOBAL_COST_EXCEEDS_CEILING: {
    label: { en: "Costs more than the ceiling allows", pt: "Custa mais do que o teto permite" },
    says: { en: "Her all-in cost through this route, once the real cost of bringing the money in replaces the estimate, passes the ceiling every route is held to.", pt: "O custo total para ela por esta rota, quando o custo real de trazer o dinheiro substitui a estimativa, passa do teto a que toda rota é submetida." },
    tone: "caution",
  },
  GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION: {
    label: { en: "Beyond what her month has left", pt: "Além do que sobra no mês dela" },
    says: { en: "The instalment on this gap, at the cost of bringing the money in, is more than the local routes left of what she can pay each month.", pt: "A parcela desta lacuna, ao custo de trazer o dinheiro, é mais do que as rotas locais deixaram do que ela pode pagar por mês." },
    tone: "caution",
  },
  GLOBAL_EVIDENCE_INSUFFICIENT: {
    label: { en: "Not enough reported history yet", pt: "Histórico reportado ainda insuficiente" },
    says: { en: "A cross-border route asks for more months, and better quality, than she has reported so far. Check-ins are what change this.", pt: "Uma rota internacional pede mais meses, e de melhor qualidade, do que ela reportou até agora. Os check-ins são o que muda isso." },
    tone: "caution",
  },
  GLOBAL_NO_REGULATED_ROUTE: {
    label: { en: "No regulated rail can settle it now", pt: "Nenhum trilho regulado liquida agora" },
    says: { en: "No route can turn this amount into reais today, whether for its size, its liquidity or an expired quote.", pt: "Nenhuma rota consegue transformar este valor em reais hoje, seja pelo tamanho, pela liquidez ou por uma cotação vencida." },
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
  | "impact_mandate" | "active" | "term_min_months" | "term_max_months" | "target_population">;

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

export const capitalPlanKey = (opportunityId: string) => ["platform", "capital-plan", opportunityId] as const;

export async function fetchCapitalPlan(opportunityId: string): Promise<StoredPlan | null> {
  const { data, error } = await platform.rpc("capital_plan", { p_opportunity_id: opportunityId });
  if (error) throw error;
  return (data as unknown as StoredPlan | null) ?? null;
}

/** The papers that would open a route she cannot reach yet: her most fixable refusal. */
export function missingDocuments(plan: CapitalPlan): string[] {
  const out = new Set<string>();
  for (const e of plan.evaluated) {
    const gate = e.gates.find((g) => g.gate === "documents" && !g.passed);
    for (const d of String(gate?.value ?? "").split(",")) if (d) out.add(d);
  }
  return [...out].sort();
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

/** §6's target population, in the words the impact mandate already uses. */
export const POPULATION_LABEL: Record<string, string> = localized({
  women_led: { en: "Women-led businesses", pt: "Negócios liderados por mulheres" },
  verified_community: { en: "Verified communities", pt: "Comunidades verificadas" },
  first_time_borrower: { en: "First-time borrowers", pt: "Quem nunca tomou crédito" },
  rural: { en: "Rural businesses", pt: "Negócios rurais" },
});

export const populationLabel = (code: string) => POPULATION_LABEL[code] ?? code;

/** What a fund wants back for its capital, as codes rather than prose. */
export const REPORTING_LABEL: Record<string, string> = localized({
  quarterly_impact_report: { en: "Quarterly impact report", pt: "Relatório de impacto trimestral" },
  annual_audited_accounts: { en: "Annual audited accounts", pt: "Contas auditadas anuais" },
  borrower_level_anonymised: { en: "Borrower-level data, anonymised", pt: "Dados por tomadora, anonimizados" },
});

export const reportingLabel = (code: string) => REPORTING_LABEL[code] ?? code;

/** A term range a route will fund, or the fact that it states none. */
export const termLine = (min: number | null, max: number | null): string =>
  min !== null && max !== null
    ? tr({ en: `${min} to ${max} months`, pt: `de ${min} a ${max} meses` })
    : min !== null
      ? tr({ en: `${min} months or more`, pt: `${min} meses ou mais` })
      : max !== null
        ? tr({ en: `up to ${max} months`, pt: `até ${max} meses` })
        : tr({ en: "Any term", pt: "Qualquer prazo" });

/** A basis-point cost as a percentage a year, or the fact that there is none. */
export const costLine = (bps: number | null): string =>
  bps === null ? tr({ en: "No cost of capital", pt: "Sem custo de capital" }) : `${(bps / 100).toFixed(1)}% ${tr({ en: "a year", pt: "ao ano" })}`;

const purposeLabel = (code: string) => PURPOSE_LABEL[code as keyof typeof PURPOSE_LABEL] ?? code;

/** Basis points as a percentage, at one decimal: the unit her rate is quoted in. */
const percent = (bps: number) => `${(bps / 100).toFixed(1)}%`;

const months = (n: number) =>
  n === 0 ? tr({ en: "none", pt: "nenhum" }) : tr({ en: `${n} months`, pt: `${n} meses` });

/** What the global question answered, in one line she can read. */
export const GLOBAL_DECISION: Record<GlobalEligibility["decision"], { label: string; says: string; tone: Tone }> = localized({
  eligible: {
    label: { en: "Global capital may take it", pt: "O capital global pode assumir" },
    says: { en: "What local capital could not reach passed every question asked of money that crosses a border.", pt: "O que o capital local não alcançou passou por todas as perguntas feitas a dinheiro que cruza fronteira." },
    tone: "positive",
  },
  refused: {
    label: { en: "Refused for global funding", pt: "Recusado para capital global" },
    says: { en: "A gap local capital left, which international money is not the answer to. The reasons say which question it failed.", pt: "Uma lacuna que o capital local deixou, e para a qual dinheiro internacional não é a resposta. Os motivos dizem em qual pergunta parou." },
    tone: "caution",
  },
  not_needed: {
    label: { en: "Not needed", pt: "Não foi preciso" },
    says: { en: "Local capital covered her whole request, so the question was never asked.", pt: "O capital local cobriu o pedido inteiro dela, então a pergunta nunca foi feita." },
    tone: "positive",
  },
});

/** The six gates of the global question, in the order it asks them. */
export const GLOBAL_GATE: Record<GlobalGate["gate"], string> = localized({
  gap: { en: "Is there a gap at all", pt: "Existe lacuna" },
  domestic_reconsidered: { en: "Could a local route still take it", pt: "Uma rota local ainda poderia assumir" },
  economics: { en: "What it costs her", pt: "Quanto custa para ela" },
  affordability: { en: "What her month has left", pt: "O que sobra no mês dela" },
  evidence: { en: "Reported history", pt: "Histórico reportado" },
  regulatory_route: { en: "A rail that can settle it", pt: "Um trilho que consiga liquidar" },
});

/**
 * A global gate's two sides, as gateDetail() does for the network's own. The
 * units differ gate by gate — centavos, basis points, months, a route's
 * reality — so each says its own comparison rather than printing a raw value.
 */
export function globalGateDetail(g: GlobalGate, e: GlobalEligibility["economics"]): string {
  switch (g.gate) {
    case "gap":
      return tr({
        en: `local capital left ${money(Number(g.value))}`,
        pt: `o capital local deixou ${money(Number(g.value))}`,
      });
    case "domestic_reconsidered": {
      const names = String(g.value).split(",").filter(Boolean);
      return names.length === 0
        ? tr({ en: "no local route refused this for anything she could fix", pt: "nenhuma rota local recusou isto por algo que ela possa resolver" })
        : tr({
            en: `${names.length} local route${names.length > 1 ? "s" : ""} refused this only for papers she could fetch`,
            pt: `${names.length} rota${names.length > 1 ? "s locais recusaram" : " local recusou"} isto só por documentos que ela pode buscar`,
          });
    }
    case "economics":
      return tr({
        en: `${percent(e.total_cost_bps)} a year with the conversion quoted, against a ceiling of ${percent(Number(g.limit))} — the estimate in her rate was ${percent(e.route_cost_bps)}`,
        pt: `${percent(e.total_cost_bps)} ao ano com a conversão cotada, contra um teto de ${percent(Number(g.limit))} — a estimativa na taxa dela era ${percent(e.route_cost_bps)}`,
      });
    case "affordability":
      return tr({
        en: `${money(Number(g.value))} a month on this gap; the local routes left ${money(Number(g.limit))} of what she can pay`,
        pt: `${money(Number(g.value))} por mês nesta lacuna; as rotas locais deixaram ${money(Number(g.limit))} do que ela pode pagar`,
      });
    case "evidence":
      return tr({
        en: `${g.value} months reported; a cross-border route asks ${g.limit}`,
        pt: `${g.value} meses reportados; uma rota internacional pede ${g.limit}`,
      });
    case "regulatory_route":
      return tr({
        en: `${money(Number(g.limit))} to settle, on a rail that is ${g.value}`,
        pt: `${money(Number(g.limit))} para liquidar, num trilho que é ${g.value}`,
      });
  }
}

/**
 * A gate's two sides, in the gate's own units and its own words. Both sides,
 * always: a refusal a person can check beats one she has to believe. The values
 * arrive from the engine as codes and centavos, and they are not readable until
 * they are put back into the language and the currency she uses.
 *
 * The instrument's kind is taken where the caller has it, for the one gate whose
 * number means something different route by route: a partner's capacity is what
 * that partner declared, and a pool's is a residue — its capital, less what it
 * has lent, less what other requests are already holding. "Capacity exhausted"
 * without that is a refusal nobody can check.
 */
export function gateDetail(g: Gate, type?: InstrumentType): string {
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
    case "term": {
      const [min, max] = g.limit as (number | null)[];
      const range = min !== null && max !== null
        ? tr({ en: `${min} to ${max} months`, pt: `de ${min} a ${max} meses` })
        : min !== null
          ? tr({ en: `${min} months or more`, pt: `${min} meses ou mais` })
          : max !== null
            ? tr({ en: `up to ${max} months`, pt: `até ${max} meses` })
            : tr({ en: "any term", pt: "qualquer prazo" });
      return tr({
        en: `she needs ${months(Number(g.value))}; this route funds ${range}`,
        pt: `ela precisa de ${months(Number(g.value))}; esta rota financia ${range}`,
      });
    }
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
      // A pool's capacity is nobody's declaration: it is what its capital comes
      // to after the loans it has out and the requests the allocation engine
      // has already listed on it. Naming that is the difference between a
      // number and a reason.
      return type === "domestic_p2p" || type === "global_impact_capital"
        ? tr({
            en: `${money(Number(g.limit))} left in the pool — its capital, less what it has lent and less what other requests the allocation engine listed on it are holding; its smallest ticket is ${money(Number(g.value))}`,
            pt: `restam ${money(Number(g.limit))} no pool — o capital dele, menos o que já emprestou e menos o que outros pedidos listados nele pelo motor de alocação estão segurando; o menor ticket dele é ${money(Number(g.value))}`,
          })
        : tr({
            en: `${money(Number(g.limit))} left of what this provider states; its smallest ticket is ${money(Number(g.value))}`,
            pt: `restam ${money(Number(g.limit))} do que este provedor declara; o menor ticket dele é ${money(Number(g.value))}`,
          });
  }
}
