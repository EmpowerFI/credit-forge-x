// report — the monthly and weekly readings she receives, and everything that
// keeps them honest. A month is "YYYY-MM"; a week of the daily journal is named
// by its Monday. Only the words change between them: the same figures engine,
// the same checks, the same fallback.
//
// The numbers come from checkin-insights and are final before this file sees
// them. The model is asked to write four short things in Portuguese about
// those numbers -- a summary, up to two observations, one practical action and
// a note on how much to trust the figures -- and nothing it returns reaches
// her until it has passed every check below. Anything that fails is replaced,
// not repaired, by a reading built from fixed sentences.
//
// The checks are the product requirements, enforced rather than requested:
//
//   * It never invents a number. Every figure in the text must be one this
//     file handed over, in the form it was handed over. A model that rounds
//     R$ 3.450,00 to "quase 3,5 mil" has written a number nobody computed.
//   * It never promises credit, diagnoses default or calls anything profit.
//     Credit is outside this product's first version entirely; "lucro" is the
//     word the requirements reserve for a result that is complete, and this
//     reading always says "resultado".
//   * It never sees who she is. No name, no phone, no city -- only the
//     figures, the signals and what she sells. Her name is added to the
//     message afterwards, by code, from the database.
//
// Pure: no network, no database, no clock. The Anthropic request is built and
// its response parsed here, and sent elsewhere.

import { type InsightFlag, type Insights, type Span, spanOf } from "./checkin-insights/index.ts";

export const PROMPT_VERSION = "report-prompt-v0.7.0";
export const DEFAULT_MODEL = "claude-haiku-5-5";

/** The reading, as the model must return it and as the fallback builds it. */
export interface Report {
  summary: string;
  observations: string[];
  action: string;
  limits: string;
  /** A week's advice (v0.7.0): one good practice to praise; empty when there is none to say truthfully. */
  praise?: string;
  /** A week's advice: one place to improve, given what she sells; empty when the week shows none. */
  improve?: string;
}

// ------------------------------------------------------------------ figures

/** Cents as Brazilians write money: 345000 -> "3.450,00". Integer arithmetic only. */
export function formatBRL(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error(`not cents: ${cents}`);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centavos = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${reais},${centavos}`;
}

/** Basis points as a percentage with one decimal: 5652 -> "56,5". */
export function formatPercent(bps: number): string {
  if (!Number.isInteger(bps)) throw new Error(`not basis points: ${bps}`);
  const negative = bps < 0;
  const tenths = Math.round(Math.abs(bps) / 10); // one decimal place of a percent
  const whole = Math.floor(tenths / 10);
  return `${negative ? "-" : ""}${whole},${tenths % 10}`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-10" -> "outubro de 2026". */
export function monthName(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTHS[Number(m) - 1]} de ${y}`;
}

/** "2026-10-12" -> "semana de 12 a 18 de outubro de 2026", across months and years too. */
export function weekName(monday: string): string {
  const a = new Date(`${monday}T12:00:00Z`);
  const b = new Date(a);
  b.setUTCDate(b.getUTCDate() + 6);
  const day = (d: Date) => d.getUTCDate();
  const mon = (d: Date) => MONTHS[d.getUTCMonth()];
  const yr = (d: Date) => d.getUTCFullYear();
  if (yr(a) !== yr(b)) return `semana de ${day(a)} de ${mon(a)} de ${yr(a)} a ${day(b)} de ${mon(b)} de ${yr(b)}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `semana de ${day(a)} de ${mon(a)} a ${day(b)} de ${mon(b)} de ${yr(b)}`;
  return `semana de ${day(a)} a ${day(b)} de ${mon(b)} de ${yr(b)}`;
}

/** What the period is called in a sentence: "outubro de 2026" or "semana de 12 a 18 de outubro de 2026". */
export function periodName(period: string): string {
  return spanOf(period) === "week" ? weekName(period) : monthName(period);
}

/** The words that change between a month and a week. */
const WORDS: Record<Span, {
  unit: string; this: string; previous: string; next: string; nextTitle: string; activeDays: string;
}> = {
  month: {
    unit: "mês", this: "neste mês", previous: "ao mês anterior", next: "Nas próximas duas semanas",
    nextTitle: "Para as próximas duas semanas", activeDays: "Dias trabalhados",
  },
  week: {
    unit: "semana", this: "na semana", previous: "à semana anterior", next: "Nos próximos dias",
    nextTitle: "Para esta semana", activeDays: "Dias com venda",
  },
};

/**
 * The figures the model may use, already written the way the reading must
 * write them, and the set of number strings any sentence may contain.
 */
export interface Facts {
  lines: string[];
  allowedNumbers: Set<string>;
  /** Her pay is known, so profit can be said: "lucro" and "prejuízo" are allowed. */
  profitWords: boolean;
}

export function factsFor(i: Insights): Facts {
  const lines: string[] = [];
  const allowed = new Set<string>();
  const money = (label: string, cents: number) => {
    const full = formatBRL(cents);
    lines.push(`${label}: R$ ${full}`);
    allowed.add(full.replace(/^-/, ""));
    // Whole-real amounts may be written without the centavos: "R$ 3.450".
    if (full.endsWith(",00")) allowed.add(full.replace(/^-/, "").slice(0, -3));
  };

  const span = spanOf(i.period);
  const name = periodName(i.period);
  lines.push(span === "week" ? `Período: ${name}` : `Mês: ${name}`);
  // Every number in the period's name may be repeated: its days and years.
  for (const n of numbersIn(name)) allowed.add(n);

  // The diary counts a week's money when it moves (20261221): an instalment
  // in the week it falls due, not the whole sale on the day it was made.
  if (span === "week") lines.push("Os valores são o dinheiro que entrou e saiu na semana: de uma venda ou compra parcelada, só conta a parcela que caiu nela");
  money("Vendas", i.revenue_cents);
  if (i.business_cost_cents !== null) money("Custos do negócio", i.business_cost_cents);
  else lines.push("Custos do negócio: ela não soube informar uma parte deles");
  if (i.result_cents !== null) {
    money(i.result_is_estimated ? "Resultado estimado" : "Resultado", i.result_cents);
  } else {
    lines.push("Resultado: não dá para calcular, porque falta um custo");
  }
  if (i.margin_bps !== null) {
    const p = formatPercent(i.margin_bps);
    lines.push(`Margem: ${p}%`);
    allowed.add(p.replace(/^-/, ""));
  }
  if (i.pay_cents !== null) money("Salário dela no período (o que ela precisa para viver, um custo do negócio)", i.pay_cents);
  if (i.profit_cents !== null) {
    if (i.profit_cents >= 0) money("Lucro (o que sobrou das vendas depois dos gastos e do salário dela)", i.profit_cents);
    else money("Prejuízo (o que faltou nas vendas para cobrir os gastos e o salário dela)", -i.profit_cents);
  }
  money("Retirado para casa", i.household_cents);
  lines.push(`${WORDS[span].activeDays}: ${i.active_days}`);
  allowed.add(String(i.active_days));
  if (span === "week" && i.open_days !== null) {
    lines.push(`Dias em que o negócio abre na semana: ${i.open_days}`);
    allowed.add(String(i.open_days));
  }

  if (i.previous_period !== null && i.revenue_prev_cents !== null) {
    if (span === "week") {
      money("Vendas na semana anterior", i.revenue_prev_cents);
    } else {
      money(`Vendas em ${monthName(i.previous_period)}`, i.revenue_prev_cents);
      allowed.add(i.previous_period.slice(0, 4));
    }
    if (i.revenue_change_bps !== null) {
      const p = formatPercent(i.revenue_change_bps);
      lines.push(`Variação das vendas: ${p}%`);
      allowed.add(p.replace(/^-/, ""));
    }
  }

  lines.push(`Qualidade dos dados: ${QUALITY_PT[i.data_quality]}`);
  if (i.flags.length) lines.push(`Sinais: ${i.flags.join(", ")}`);
  return { lines, allowedNumbers: allowed, profitWords: i.profit_cents !== null };
}

const QUALITY_PT = {
  complete: "completa — ela anota todas as vendas",
  estimated: "estimada — ela não anota as vendas, os valores são de memória",
  incomplete: "incompleta — falta um dos custos",
} as const;

// ------------------------------------------------------------------- prompt

function systemFor(span: Span, profitWords = false): string {
  const w = WORDS[span];
  return [
    `Você escreve, em português do Brasil, a leitura ${span === "week" ? "semanal" : "mensal"} do negócio de uma microempreendedora.`,
    "Ela vai ler no diário da EmpowerFI, no celular. Escreva como uma pessoa próxima e respeitosa escreveria: frases curtas, palavras simples, sem jargão financeiro.",
    "",
    "Regras que não podem ser quebradas:",
    "1. Use apenas os números da lista de fatos, escritos exatamente como estão lá. Não arredonde, não some, não calcule, não crie nenhum número novo.",
    profitWords
      ? "2. Lucro é só o que sobrou das vendas depois dos gastos do negócio e do salário dela, o valor de Lucro da lista. Se a lista traz Prejuízo, diga prejuízo. Chame o salário de \"o seu salário\" ou \"o que você precisa para passar o mês\", nunca de pró-labore. Se os valores forem estimados, diga que é uma estimativa."
      : "2. Nunca use a palavra lucro nem prejuízo, nem pró-labore. Fale em resultado. Se o resultado for estimado, diga que é uma estimativa.",
    "3. Nunca fale de crédito, empréstimo, financiamento, score ou risco de inadimplência.",
    `4. Nunca culpe ou acuse. ${span === "week" ? "Uma semana difícil" : "Um mês difícil"} é um fato, não um erro dela. Se algum número parecer inconsistente, peça com gentileza que ela confira.`,
    `5. A ação prática deve ser uma só, pequena e possível de fazer ${span === "week" ? "nesta semana que começa" : "nas próximas duas semanas"}, sem gastar dinheiro.`,
    "   Ela usa o diário da EmpowerFI justamente para não precisar de papel: nunca sugira papel, caderno, caderneta, planilha, bloco de notas nem outro aplicativo. Se a ação for anotar ou acompanhar algo, é no próprio diário: registrar no diário cada gasto no dia em que paga, anotar as vendas pequenas também, olhar em Seu mês quanto falta vender, marcar os dias em que o negócio abre.",
    "6. Não dê conselho contábil, jurídico ou de investimento.",
    "",
    `Sobre os sinais: RESULT_NEGATIVE quer dizer que os custos passaram das vendas. HOUSEHOLD_OVER_RESULT quer dizer que ela retirou para casa mais do que o negócio gerou. HOUSEHOLD_OVER_REVENUE sugere que o dinheiro da casa e do negócio estão misturados. FIGURES_ESTIMATED e COST_UNKNOWN pedem cuidado ao tirar conclusões. REVENUE_UP e REVENUE_DOWN são mudanças grandes em relação ${w.previous}. FEW_ACTIVE_DAYS quer dizer que o negócio vendeu em poucos dias ${w.this}. PROFIT_NEGATIVE quer dizer que as vendas não cobriram os gastos e o salário dela.`,
    ...(span === "week"
      ? ["Os dias em que o negócio não abre não são falta: nunca diga que ela deixou de vender ou de anotar nesses dias."]
      : []),
  ].join("\n");
}

/** What the model is shown. She is described only by what she sells. */
export function promptFor(i: Insights, sector?: string | null): { system: string; user: string; facts: Facts } {
  const facts = factsFor(i);
  const span = spanOf(i.period);
  const user = [
    sector ? `Ela trabalha com: ${sector.slice(0, 60)}` : "O ramo dela não foi informado.",
    "",
    `Fatos ${span === "week" ? "da semana" : "do mês"}:`,
    ...facts.lines.map((l) => `- ${l}`),
    "",
    "Escreva a leitura usando a ferramenta write_report.",
  ].join("\n");
  return { system: systemFor(span, facts.profitWords), user, facts };
}

/** Forces a JSON object of exactly this shape out of the model. */
export const REPORT_TOOL = {
  name: "write_report",
  description: "Registra a leitura do negócio no período.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Resumo do período em até duas frases." },
      observations: {
        type: "array",
        items: { type: "string" },
        maxItems: 2,
        description: "Até duas observações sobre os números, uma frase cada.",
      },
      action: { type: "string", description: "Uma única ação prática para o próximo período." },
      limits: { type: "string", description: "Uma frase sobre o quanto confiar nestes números." },
    },
    required: ["summary", "observations", "action", "limits"],
    additionalProperties: false,
  },
} as const;

export function anthropicRequest(apiKey: string, model: string, i: Insights, sector?: string | null): {
  url: string;
  init: RequestInit;
  facts: Facts;
} {
  const { system, user, facts } = promptFor(i, sector);
  return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system,
        tools: [REPORT_TOOL],
        tool_choice: { type: "tool", name: REPORT_TOOL.name },
        messages: [{ role: "user", content: user }],
      }),
    },
    facts,
  };
}

/** The tool input and token usage out of a Messages API response. Null when absent. */
export function parseAnthropicResponse(body: unknown, toolName: string = REPORT_TOOL.name): {
  input: unknown;
  inputTokens: number;
  outputTokens: number;
} | null {
  const b = body as {
    content?: Array<{ type?: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const block = b?.content?.find((c) => c?.type === "tool_use" && c?.name === toolName);
  if (!block) return null;
  return {
    input: block.input,
    inputTokens: Number(b.usage?.input_tokens ?? 0),
    outputTokens: Number(b.usage?.output_tokens ?? 0),
  };
}

// --------------------------------------------------------------- validation

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Words that, anywhere in the reading, mean it has stepped outside what this
 * product may say. Matched without accents so "crédito" and "credito" are one.
 */
const FORBIDDEN = ["credito", "emprestimo", "financiamento", "inadimpl", "score", "pro-labore", "pro labore", "prolabore"];
/** Said only when her pay is known, so that profit means what is left after it. */
const PROFIT_WORDS = ["lucro", "prejuizo"];
/**
 * The diary is what replaces her notebook: a reading never sends her back to
 * paper or to another tool to keep her figures. Whole words, so "papelaria",
 * a business she may run, is not one.
 */
const PAPER = /\b(papel|papeis|papeizinhos|caderno|cadernos|caderneta|planilha|planilhas|bloco de notas|excel)\b/;

const LIMITS = { summary: 320, observation: 240, action: 240, limits: 240 } as const;

/**
 * Every number-like token in the text. "R$ 3.450,00" yields "3.450,00";
 * "56,5%" yields "56,5"; a trailing sentence period is not part of a number.
 */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d.,]*/g) ?? []).map((t) => t.replace(/[.,]+$/, ""));
}

/**
 * The model's output, accepted only if it is exactly the reading this product
 * may send. Returns the reasons it was refused, never a corrected version:
 * a reading that needed fixing is a reading nobody checked.
 */
export function validateReport(raw: unknown, allowedNumbers: Set<string>, profitWords = false): { ok: true; report: Report } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  const r = raw as Partial<Report> | null;
  if (r === null || typeof r !== "object") return { ok: false, reasons: ["not an object"] };

  const text = (v: unknown, field: string, max: number): string | null => {
    if (typeof v !== "string") { reasons.push(`${field} is not text`); return null; }
    const t = v.trim();
    if (t.length === 0) { reasons.push(`${field} is empty`); return null; }
    if (t.length > max) { reasons.push(`${field} is longer than ${max} characters`); return null; }
    return t;
  };

  const summary = text(r.summary, "summary", LIMITS.summary);
  const action = text(r.action, "action", LIMITS.action);
  const limits = text(r.limits, "limits", LIMITS.limits);
  let observations: string[] = [];
  if (!Array.isArray(r.observations)) reasons.push("observations is not a list");
  else if (r.observations.length > 2) reasons.push("more than two observations");
  else {
    observations = r.observations
      .map((o, n) => text(o, `observation ${n + 1}`, LIMITS.observation))
      .filter((o): o is string => o !== null);
  }

  const all = [summary, action, limits, ...observations].filter((s): s is string => s !== null).join(" ");
  const plain = strip(all);
  for (const word of profitWords ? FORBIDDEN : [...FORBIDDEN, ...PROFIT_WORDS]) {
    if (plain.includes(word)) reasons.push(`uses the forbidden word "${word}"`);
  }
  const paper = plain.match(PAPER);
  if (paper) reasons.push(`sends her to keep her figures outside the diary: "${paper[1]}"`);

  // Every figure in the prose must be one we computed. Single digits are let
  // through as counting words -- "uma ação", "2 semanas" -- because a single
  // digit cannot be a sum of money.
  for (const n of numbersIn(all)) {
    if (/^\d$/.test(n)) continue;
    if (!allowedNumbers.has(n)) reasons.push(`contains a number nobody computed: ${n}`);
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true, report: { summary: summary!, observations, action: action!, limits: limits! } };
}

// ------------------------------------------------------------------ fallback

/**
 * Fixed, kind sentences per signal. Ordered by what matters most to say first:
 * a mixed household draw is the single most useful thing the product can help
 * her see, so it leads when it is present.
 */
function observationsFor(span: Span): Partial<Record<InsightFlag, string>> {
  const w = WORDS[span];
  return {
    HOUSEHOLD_OVER_REVENUE: "O que foi retirado para casa passou do total das vendas. Isso costuma acontecer quando o dinheiro da casa e o do negócio ficam juntos.",
    RESULT_NEGATIVE: `${span === "week" ? "Na semana," : "Neste mês"} os custos do negócio passaram das vendas. ${span === "week" ? "Uma semana assim" : "Um mês assim"} acontece, e vale entender o que pesou mais.`,
    PROFIT_NEGATIVE: `${span === "week" ? "Na semana," : "Neste mês,"} as vendas ainda não cobriram os gastos e o seu salário. Vale ver o que dá para vender a mais ou gastar a menos.`,
    HOUSEHOLD_OVER_RESULT: `O que foi retirado para casa foi maior do que o resultado do negócio ${w.this}.`,
    REVENUE_DOWN: `As vendas caíram em relação ${w.previous}.`,
    REVENUE_UP: `As vendas subiram em relação ${w.previous}.`,
    FEW_ACTIVE_DAYS: `O negócio vendeu em poucos dias ${w.this}.`,
    REVENUE_ZERO: `Não houve vendas registradas ${w.this}.`,
  };
}

function actionsFor(span: Span): Partial<Record<InsightFlag, string>> {
  const next = WORDS[span].next;
  return {
    HOUSEHOLD_OVER_REVENUE: `${next}, tente guardar o dinheiro do negócio num lugar separado do dinheiro da casa, nem que seja um envelope.`,
    RESULT_NEGATIVE: `${next}, registre no diário cada compra de material com o valor. Assim fica mais fácil ver onde o custo está pesando.`,
    PROFIT_NEGATIVE: `${next}, olhe em Seu mês quanto falta vender por dia para cobrir os gastos e o seu salário.`,
    FIGURES_ESTIMATED: `${next}, experimente anotar no diário cada venda no dia em que acontece, mesmo as pequenas.`,
    COST_UNKNOWN: `${next}, registre no diário o valor de cada compra do negócio, no dia em que pagar.`,
  };
}

export function fallbackReport(i: Insights): Report {
  const span = spanOf(i.period);
  const summaryParts = [
    span === "week"
      ? `Na ${periodName(i.period)}, as vendas foram de R$ ${formatBRL(i.revenue_cents)}.`
      : `Em ${monthName(i.period)}, as vendas foram de R$ ${formatBRL(i.revenue_cents)}.`,
  ];
  if (i.profit_cents !== null && i.pay_cents !== null) {
    // Her pay is a cost: profit is what the sales leave after the expenses and it.
    summaryParts.push(i.profit_cents >= 0
      ? `Depois de pagar os gastos do negócio e o seu salário de R$ ${formatBRL(i.pay_cents)}, sobrou um lucro de R$ ${formatBRL(i.profit_cents)}.`
      : `As vendas não cobriram os gastos do negócio e o seu salário de R$ ${formatBRL(i.pay_cents)}: faltaram R$ ${formatBRL(-i.profit_cents)}.`);
  } else if (i.result_cents !== null && i.result_cents < 0) {
    // Said in words rather than as "R$ -300,00", which nobody reads well.
    summaryParts.push(
      `${i.result_is_estimated ? "Pela estimativa, os" : "Os"} custos do negócio passaram das vendas em R$ ${formatBRL(-i.result_cents)}.`,
    );
  } else if (i.result_cents !== null) {
    summaryParts.push(
      i.result_is_estimated
        ? `O resultado estimado do negócio foi de R$ ${formatBRL(i.result_cents)}.`
        : `O resultado do negócio foi de R$ ${formatBRL(i.result_cents)}.`,
    );
  }

  const OBSERVATION_FOR = observationsFor(span);
  const observations: string[] = [];
  for (const flag of Object.keys(OBSERVATION_FOR) as InsightFlag[]) {
    if (observations.length === 2) break;
    if (i.flags.includes(flag)) observations.push(OBSERVATION_FOR[flag]!);
  }

  const ACTION_FOR = actionsFor(span);
  const actionFlag = (Object.keys(ACTION_FOR) as InsightFlag[]).find((f) => i.flags.includes(f));
  const action = actionFlag
    ? ACTION_FOR[actionFlag]!
    : `${WORDS[span].next}, continue registrando no diário as vendas e as compras do negócio. É isso que deixa a próxima leitura mais precisa.`;

  const limits =
    i.data_quality === "complete"
      ? "Estes números vêm das suas anotações, então dá para confiar bem neles."
      : i.data_quality === "estimated"
        ? "Como os valores foram lembrados e não anotados, use esta leitura como uma estimativa."
        : `Faltou um dos custos, então o resultado ${span === "week" ? "da semana" : "do mês"} ficou de fora desta leitura.`;

  return { summary: summaryParts.join(" "), observations, action, limits };
}

// ------------------------------------------------------------------ a week's advice

/**
 * Since 12/11/2026 a week's reading is advice, in the manner of a
 * small-business adviser (as Sebrae gives it): how the week went, one good
 * practice to praise, one place to improve given what she sells, and one tip.
 * Short, warm and plain. The same rules hold -- only computed numbers, no
 * credit, no blame, no paper -- and the same fallback idea: fixed sentences
 * when the model is off, down or refused.
 */

/** Where the week's money came from and went (journal_reading_inputs.detail). */
export interface WeekDetail {
  days_recorded?: number | null;
  sales_by_method?: Record<string, number> | null;
  expenses_by_category?: { category: string | null; cents: number }[] | null;
}

const METHOD_PT: Record<string, string> = {
  pix: "Pix", cash: "dinheiro", debit_card: "cartão de débito", credit_card: "cartão de crédito", fiado: "fiado",
};
// Plain names for her categories. "parcela de dívida", not "de empréstimo": the
// reading may not say empréstimo, and a fact the model repeats must pass.
const CATEGORY_PT: Record<string, string> = {
  stock: "mercadoria ou matéria-prima", packaging: "embalagem", fees: "taxa da maquininha",
  app_fees: "taxa de app ou marketplace", transport: "transporte e entrega", rent_utilities: "aluguel, água, luz e internet",
  marketing: "divulgação", staff: "ajudante ou funcionário", equipment: "equipamento", debt: "parcela de dívida", other: "outros gastos do negócio",
};

/** The week's facts, with where the money came from and went. */
export function adviceFacts(i: Insights, detail?: WeekDetail | null): Facts {
  const facts = factsFor(i);
  const money = (label: string, cents: number) => {
    if (!Number.isInteger(cents) || cents <= 0) return;
    const full = formatBRL(cents);
    facts.lines.push(`${label}: R$ ${full}`);
    facts.allowedNumbers.add(full);
    if (full.endsWith(",00")) facts.allowedNumbers.add(full.slice(0, -3));
  };
  const days = detail?.days_recorded;
  if (Number.isInteger(days) && days! >= 0 && days! <= 7) {
    facts.lines.push(`Dias registrados no diário na semana: ${days}`);
    facts.allowedNumbers.add(String(days));
  }
  const methods = Object.entries(detail?.sales_by_method ?? {}).filter(([, c]) => Number.isInteger(c) && c > 0).sort((a, b) => b[1] - a[1]);
  if (methods.length) {
    facts.lines.push("De onde veio o dinheiro das vendas:");
    for (const [m, c] of methods) money(`  vendas em ${METHOD_PT[m] ?? m}`, c);
  }
  const costs = (detail?.expenses_by_category ?? []).filter((e) => Number.isInteger(e?.cents) && e.cents > 0).slice(0, 6);
  if (costs.length) {
    facts.lines.push("Para onde foram os gastos do negócio:");
    for (const e of costs) money(`  ${CATEGORY_PT[e.category ?? "other"] ?? "outros gastos do negócio"}`, e.cents);
  }
  return facts;
}

function adviceSystem(profitWords: boolean): string {
  return [
    "Você é uma conselheira de pequenos negócios, no jeito das orientações do Sebrae: prática, próxima e encorajadora.",
    "Você escreve, em português do Brasil, um conselho curto sobre a semana do negócio de uma microempreendedora. Ela lê no diário da EmpowerFI, no celular.",
    "Olhe para o ramo dela (o que ela vende ou faz) e para os números da semana: quanto vendeu, de onde veio o dinheiro, para onde foram os gastos, em quantos dias vendeu e registrou.",
    "Tom: acolhedor e simples, como uma conversa. Trate-a por \"você\". Frases curtas, palavras do dia a dia, sem jargão (nada de fluxo de caixa, margem de contribuição ou capital de giro).",
    "Seja concisa: cada campo tem uma ou duas frases.",
    "",
    "Campos:",
    "- summary: como foi a semana, com os números principais.",
    "- praise: uma boa prática dela que merece parabéns, tirada dos números (registrou todos os dias em que abriu, vendas subiram, gastos sob controle, vendeu em vários dias, recebeu mais em Pix ou dinheiro do que no fiado...). Deixe vazio se não houver nada verdadeiro para elogiar.",
    "- improve: um ponto em que ela pode melhorar, pensando no ramo dela e nos números (um gasto que pesou, muito fiado, poucos dias com venda, retirada para casa alta...). Deixe vazio se a semana não mostrar nenhum.",
    "- action: uma dica prática e pequena para esta semana, pensada para o ramo dela, possível de fazer sem gastar dinheiro.",
    "",
    "Regras que não podem ser quebradas:",
    "1. Use apenas os números da lista de fatos, escritos exatamente como estão lá. Não arredonde, não some, não calcule, não crie nenhum número novo. Pode falar sem números.",
    profitWords
      ? "2. Lucro é só o que sobrou das vendas depois dos gastos do negócio e do salário dela, o valor de Lucro da lista. Se a lista traz Prejuízo, diga prejuízo. Chame o salário de \"o seu salário\", nunca de pró-labore."
      : "2. Nunca use a palavra lucro nem prejuízo, nem pró-labore. Fale em resultado.",
    "3. Nunca fale de crédito, empréstimo, financiamento, score ou risco de inadimplência.",
    "4. Nunca culpe nem cobre. Uma semana difícil é um fato, não um erro dela.",
    "5. Ela usa o diário da EmpowerFI justamente para não precisar de papel: nunca sugira papel, caderno, caderneta, planilha nem outro aplicativo. Se a dica for anotar algo, é no próprio diário.",
    "6. Não dê conselho contábil, jurídico ou de investimento, e não invente nada sobre o negócio dela além do ramo e dos números.",
    "7. Não diga que você é do Sebrae nem fale em nome de nenhuma instituição.",
    "8. Os dias em que o negócio não abre não são falta: nunca diga que ela deixou de vender ou de anotar nesses dias.",
  ].join("\n");
}

/** Forces the advice out of the model, in exactly this shape. */
export const ADVICE_TOOL = {
  name: "write_advice",
  description: "Registra o conselho da semana para a empreendedora.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Como foi a semana, em até duas frases curtas." },
      praise: { type: "string", description: "Uma boa prática para parabenizar, em uma frase. Vazio se não houver." },
      improve: { type: "string", description: "Um ponto para melhorar, pensando no ramo dela, em uma frase. Vazio se não houver." },
      action: { type: "string", description: "Uma dica prática e pequena para esta semana, em até duas frases." },
    },
    required: ["summary", "praise", "improve", "action"],
    additionalProperties: false,
  },
} as const;

export function adviceRequest(apiKey: string, model: string, i: Insights, sector?: string | null, detail?: WeekDetail | null): {
  url: string;
  init: RequestInit;
  facts: Facts;
} {
  const facts = adviceFacts(i, detail);
  const user = [
    sector ? `Ela trabalha com: ${sector.slice(0, 60)}` : "O ramo dela não foi informado.",
    "",
    "Fatos da semana:",
    ...facts.lines.map((l) => (l.startsWith("  ") ? `  - ${l.trim()}` : `- ${l}`)),
    "",
    "Escreva o conselho usando a ferramenta write_advice.",
  ].join("\n");
  return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: adviceSystem(facts.profitWords),
        tools: [ADVICE_TOOL],
        tool_choice: { type: "tool", name: ADVICE_TOOL.name },
        messages: [{ role: "user", content: user }],
      }),
    },
    facts,
  };
}

const ADVICE_LIMITS = { summary: 280, praise: 220, improve: 220, action: 260 } as const;

/** How much to trust the week's figures, said by code. */
export function limitsFor(i: Insights): string {
  return i.data_quality === "complete"
    ? "Estes números vêm das suas anotações."
    : i.data_quality === "estimated"
      ? "Como os valores foram lembrados e não anotados, use este conselho como uma estimativa."
      : "Faltou um dos custos, então o resultado da semana ficou de fora.";
}

/** The model's advice, accepted only if it passes every check validateReport runs. */
export function validateAdvice(raw: unknown, allowedNumbers: Set<string>, profitWords: boolean, limits: string):
  { ok: true; report: Report } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  const r = raw as { summary?: unknown; praise?: unknown; improve?: unknown; action?: unknown } | null;
  if (r === null || typeof r !== "object") return { ok: false, reasons: ["not an object"] };
  const text = (v: unknown, field: keyof typeof ADVICE_LIMITS, optional: boolean): string | null => {
    if (typeof v !== "string") { reasons.push(`${field} is not text`); return null; }
    const t = v.trim();
    if (t.length === 0) { if (!optional) reasons.push(`${field} is empty`); return ""; }
    if (t.length > ADVICE_LIMITS[field]) { reasons.push(`${field} is longer than ${ADVICE_LIMITS[field]} characters`); return null; }
    return t;
  };
  const summary = text(r.summary, "summary", false);
  const praise = text(r.praise, "praise", true);
  const improve = text(r.improve, "improve", true);
  const action = text(r.action, "action", false);

  const all = [summary, praise, improve, action].filter((x): x is string => !!x).join(" ");
  const plain = strip(all);
  for (const word of profitWords ? FORBIDDEN : [...FORBIDDEN, ...PROFIT_WORDS]) {
    if (plain.includes(word)) reasons.push(`uses the forbidden word "${word}"`);
  }
  if (plain.includes("sebrae")) reasons.push("speaks in Sebrae's name");
  const paper = plain.match(PAPER);
  if (paper) reasons.push(`sends her to keep her figures outside the diary: "${paper[1]}"`);
  for (const n of numbersIn(all)) {
    if (/^\d$/.test(n)) continue;
    if (!allowedNumbers.has(n)) reasons.push(`contains a number nobody computed: ${n}`);
  }
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, report: { summary: summary!, observations: [], praise: praise!, improve: improve!, action: action!, limits } };
}

/** The week's advice in fixed sentences: when the AI is off, down or refused. */
export function fallbackAdvice(i: Insights, detail?: WeekDetail | null): Report {
  const base = fallbackReport(i);
  const days = detail?.days_recorded;
  let praise = "";
  if (Number.isInteger(days) && i.open_days !== null && days! >= i.open_days) {
    praise = "Você registrou todos os dias em que abriu. Essa constância faz diferença!";
  } else if (i.flags.includes("REVENUE_UP")) {
    praise = "As vendas subiram em relação à semana anterior. Muito bem!";
  } else if (i.profit_cents !== null && i.profit_cents >= 0 && i.revenue_cents > 0) {
    praise = "As vendas cobriram os gastos e o seu salário. Parabéns!";
  } else if (i.result_cents !== null && i.result_cents > 0 && !i.result_is_estimated) {
    praise = "O negócio fechou a semana com as vendas acima dos gastos.";
  }
  const OBS = observationsFor("week");
  const negative = (Object.keys(OBS) as InsightFlag[]).filter((f) => f !== "REVENUE_UP");
  const flag = negative.find((f) => i.flags.includes(f));
  const improve = flag ? OBS[flag]! : "";
  return { summary: base.summary, observations: [], praise, improve, action: base.action, limits: limitsFor(i) };
}

// ------------------------------------------------------------------ message

/** The WhatsApp text. Her name enters here, from the database, never from the model. */
/** How closely she kept the journal, said by code: "Você registrou em 24 dos últimos 30 dias." */
export function coverageLine(c: { kept: number; days: number } | null | undefined): string | null {
  if (!c || !Number.isInteger(c.kept) || !Number.isInteger(c.days) || c.days < 7) return null;
  const kept = Math.min(c.kept, c.days);
  return c.days >= 30
    ? `📅 Você registrou em ${kept} dos últimos 30 dias.`
    : `📅 Você registrou em ${kept} dos ${c.days} dias desde que começou.`;
}

export function renderMessage(report: Report, firstName?: string | null, span: Span = "month", footer?: string | null): string {
  const whose = span === "week" ? "da sua semana" : "do seu mês";
  const greeting = firstName ? `Oi, ${firstName.split(" ")[0]}! Aqui está a leitura ${whose} 💜` : `Aqui está a leitura ${whose} 💜`;
  const parts = [greeting, report.summary];
  if (report.praise) parts.push(`👏 ${report.praise}`);
  if (report.improve) parts.push(`🌱 ${report.improve}`);
  if (report.observations.length) parts.push(report.observations.map((o) => `• ${o}`).join("\n"));
  parts.push(`*${WORDS[span].nextTitle}:* ${report.action}`);
  parts.push(`_${report.limits}_`);
  if (footer) parts.push(footer);
  return parts.join("\n\n");
}

/** Cost in micro-dollars from token counts and per-million-token prices. Null without prices. */
export function costMicroUsd(inputTokens: number, outputTokens: number, usdPerMTokIn?: number, usdPerMTokOut?: number): number | null {
  if (usdPerMTokIn === undefined || usdPerMTokOut === undefined) return null;
  if (!Number.isFinite(usdPerMTokIn) || !Number.isFinite(usdPerMTokOut)) return null;
  // USD per million tokens equals micro-USD per token.
  return Math.round(inputTokens * usdPerMTokIn + outputTokens * usdPerMTokOut);
}
