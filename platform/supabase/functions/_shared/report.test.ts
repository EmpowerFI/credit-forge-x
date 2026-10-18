import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { computeInsights, type MonthFigures } from "./checkin-insights/index.ts";
import {
  anthropicRequest, costMicroUsd, DEFAULT_MODEL, factsFor, fallbackReport, formatBRL, formatPercent,
  coverageLine, monthName, numbersIn, parseAnthropicResponse, promptFor, renderMessage, validateReport, weekName,
} from "./report.ts";

const month = (over: Partial<MonthFigures> = {}): MonthFigures => ({
  period: "2026-10",
  revenue_cents: 345_000,
  cogs_cents: 120_000,
  opex_cents: 30_000,
  household_cents: 90_000,
  keeps_records: true,
  active_days: 22,
  ...over,
});
const insights = (over: Partial<MonthFigures> = {}, previous?: Partial<MonthFigures>) =>
  computeInsights({ current: month(over), previous: previous ? month({ period: "2026-09", ...previous }) : null });

Deno.test("money as Brazilians write it, from integers", () => {
  assertEquals(formatBRL(345_000), "3.450,00");
  assertEquals(formatBRL(5), "0,05");
  assertEquals(formatBRL(100_000_000), "1.000.000,00");
  assertEquals(formatBRL(-30_000), "-300,00");
  assertEquals(formatBRL(0), "0,00");
  assertThrows(() => formatBRL(1.5));
});

Deno.test("percentages with one decimal, from basis points", () => {
  assertEquals(formatPercent(5652), "56,5");
  assertEquals(formatPercent(-3333), "-33,3");
  assertEquals(formatPercent(0), "0,0");
  assertEquals(formatPercent(10_000), "100,0");
});

Deno.test("month names", () => {
  assertEquals(monthName("2026-10"), "outubro de 2026");
  assertEquals(monthName("2027-03"), "março de 2027");
});

Deno.test("the model is told who she is only by what she sells", () => {
  const { user, system } = promptFor(insights(), "bolos e salgados");
  assertEquals(user.includes("bolos e salgados"), true);
  assertEquals(user.includes("R$ 3.450,00"), true);
  // Nothing that identifies her is in the input at all -- insights carry no
  // name, phone or city, and the prompt adds none.
  for (const s of ["Campinas", "Maria", "+55", "telefone"]) assertEquals(user.includes(s), false, s);
  assertEquals(system.includes("lucro"), true); // named only to forbid it
  // A sector longer than sixty characters is cut, so nothing she typed at
  // length rides into the prompt.
  assertEquals(promptFor(insights(), "x".repeat(200)).user.includes("x".repeat(61)), false);
});

Deno.test("an unknown cost is described, not computed", () => {
  const { lines } = factsFor(insights({ cogs_cents: null }));
  assertEquals(lines.some((l) => l.startsWith("Resultado: não dá para calcular")), true);
  assertEquals(lines.some((l) => l.startsWith("Margem")), false);
});

const allowed = () => factsFor(insights()).allowedNumbers;
const good = {
  summary: "Em outubro de 2026 você vendeu R$ 3.450,00 e o resultado do negócio foi de R$ 1.950,00.",
  observations: ["Sua margem ficou em 56,5%, o que mostra cuidado com os custos."],
  action: "Nas próximas 2 semanas, anote cada venda no caderno.",
  limits: "Os números vêm das suas anotações, então dá para confiar bem neles.",
};

Deno.test("a reading that uses only the computed figures is accepted", () => {
  const r = validateReport(good, allowed());
  assertEquals(r.ok, true);
});

Deno.test("whole-real amounts may drop the centavos", () => {
  const r = validateReport({ ...good, summary: "Você vendeu R$ 3.450 em outubro." }, allowed());
  assertEquals(r.ok, true);
});

Deno.test("a number nobody computed is refused", () => {
  for (const summary of [
    "Você vendeu quase 3,5 mil em outubro.", // rounded: "3,5" was never handed over
    "Você vendeu R$ 3450,00.", // written without the thousands dot
    "Seu resultado cresceu 12% no mês.", // a percentage that does not exist
    "Você vendeu R$ 4.000,00.", // simply invented
  ]) {
    const r = validateReport({ ...good, summary }, allowed());
    assertEquals(r.ok, false, summary);
  }
});

Deno.test("words this product may not say", () => {
  for (const summary of [
    "Seu lucro foi de R$ 1.950,00.",
    "Com esse resultado você pode pedir crédito.",
    "Um empréstimo ajudaria a crescer.",
    "Isso melhora seu score.",
    "Há risco de inadimplência.",
    "CRÉDITO aprovado em breve.", // case and accents do not get past it
  ]) {
    assertEquals(validateReport({ ...good, summary }, allowed()).ok, false, summary);
  }
});

Deno.test("the shape is exact or it is refused", () => {
  assertEquals(validateReport(null, allowed()).ok, false);
  assertEquals(validateReport("texto", allowed()).ok, false);
  assertEquals(validateReport({ ...good, observations: ["a", "b", "c"] }, allowed()).ok, false);
  assertEquals(validateReport({ ...good, observations: "uma só" }, allowed()).ok, false);
  assertEquals(validateReport({ ...good, action: "" }, allowed()).ok, false);
  assertEquals(validateReport({ ...good, limits: "x".repeat(241) }, allowed()).ok, false);
  assertEquals(validateReport({ ...good, summary: 42 }, allowed()).ok, false);
  // No observations at all is allowed: up to two, not at least one.
  assertEquals(validateReport({ ...good, observations: [] }, allowed()).ok, true);
});

Deno.test("numbers in text, without the sentence's full stop", () => {
  assertEquals(numbersIn("Vendeu R$ 3.450,00. Margem de 56,5%."), ["3.450,00", "56,5"]);
  assertEquals(numbersIn("sem números"), []);
});

Deno.test("the fallback itself passes every check, in every kind of month", () => {
  // The safety net must not be a source of invented numbers or forbidden
  // words. Every variant of month the engine distinguishes, run through the
  // same validator the model's output goes through.
  const cases = [
    insights(),
    insights({ keeps_records: false }),
    insights({ cogs_cents: null }),
    insights({ cogs_cents: null, opex_cents: null, keeps_records: false }),
    insights({ revenue_cents: 100_000, cogs_cents: 90_000, opex_cents: 40_000 }), // negative
    insights({ revenue_cents: 100_000, cogs_cents: 90_000, opex_cents: 40_000, keeps_records: false }),
    insights({ revenue_cents: 0, cogs_cents: 0, opex_cents: 0, household_cents: 0, active_days: 2 }),
    insights({ revenue_cents: 80_000, cogs_cents: 10_000, opex_cents: 5_000, household_cents: 120_000 }),
    insights({ revenue_cents: 400_000 }, { revenue_cents: 300_000 }), // up
    insights({ revenue_cents: 200_000 }, { revenue_cents: 300_000 }), // down
  ];
  for (const i of cases) {
    const r = validateReport(fallbackReport(i), factsFor(i).allowedNumbers);
    assertEquals(r.ok, true, `${JSON.stringify(i.flags)}: ${r.ok ? "" : r.reasons.join("; ")}`);
  }
});

Deno.test("the fallback leads with the mixed-money observation when it applies", () => {
  const r = fallbackReport(insights({ revenue_cents: 80_000, cogs_cents: 10_000, opex_cents: 5_000, household_cents: 120_000 }));
  assertEquals(r.observations[0].includes("dinheiro da casa e o do negócio"), true);
  assertEquals(r.action.includes("separado"), true);
});

Deno.test("a negative month is said in words, not as a negative amount", () => {
  const r = fallbackReport(insights({ revenue_cents: 100_000, cogs_cents: 90_000, opex_cents: 40_000 }));
  assertEquals(r.summary.includes("-"), false);
  assertEquals(r.summary.includes("passaram das vendas em R$ 300,00"), true);
});

Deno.test("the request forces the tool and carries no identity", () => {
  const { url, init } = anthropicRequest("sk-test", DEFAULT_MODEL, insights(), "doces");
  assertEquals(url, "https://api.anthropic.com/v1/messages");
  const headers = init.headers as Record<string, string>;
  assertEquals(headers["x-api-key"], "sk-test");
  assertEquals(headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(String(init.body));
  assertEquals(body.model, "claude-haiku-5-5");
  assertEquals(body.tool_choice, { type: "tool", name: "write_report" });
  assertEquals(body.tools[0].input_schema.properties.observations.maxItems, 2);
});

Deno.test("the tool input and usage come out of the response", () => {
  const parsed = parseAnthropicResponse({
    content: [{ type: "text", text: "..." }, { type: "tool_use", name: "write_report", input: good }],
    usage: { input_tokens: 812, output_tokens: 190 },
  });
  assertEquals(parsed?.input, good);
  assertEquals(parsed?.inputTokens, 812);
  assertEquals(parsed?.outputTokens, 190);
  assertEquals(parseAnthropicResponse({ content: [{ type: "text", text: "sem ferramenta" }] }), null);
  assertEquals(parseAnthropicResponse(null), null);
});

Deno.test("her first name enters from the database, after the model", () => {
  const text = renderMessage(fallbackReport(insights()), "Maria Aparecida");
  assertEquals(text.startsWith("Oi, Maria!"), true);
  assertEquals(renderMessage(fallbackReport(insights())).startsWith("Aqui está"), true);
});

Deno.test("cost only when prices are known", () => {
  assertEquals(costMicroUsd(1000, 200), null);
  assertEquals(costMicroUsd(1_000_000, 0, 1, 5), 1_000_000); // a million tokens at $1/MTok is one dollar
  assertEquals(costMicroUsd(800, 200, 1, 5), 1800);
});

// ---------------------------------------------------------------- the week

const weekOf = (over: Partial<MonthFigures> = {}, previous?: Partial<MonthFigures>) =>
  computeInsights({
    current: month({ period: "2026-10-12", revenue_cents: 90_000, cogs_cents: 30_000, opex_cents: 5_000, household_cents: 20_000, active_days: 6, ...over }),
    previous: previous ? month({ period: "2026-10-05", revenue_cents: 60_000, cogs_cents: 20_000, opex_cents: 5_000, household_cents: 20_000, active_days: 5, ...previous }) : null,
  });

Deno.test("a week is named the way she would say it", () => {
  assertEquals(weekName("2026-10-12"), "semana de 12 a 18 de outubro de 2026");
  assertEquals(weekName("2026-09-28"), "semana de 28 de setembro a 4 de outubro de 2026");
  assertEquals(weekName("2025-12-29"), "semana de 29 de dezembro de 2025 a 4 de janeiro de 2026");
});

Deno.test("the week's facts let the reading repeat the week's dates, and nothing else new", () => {
  const { lines, allowedNumbers } = factsFor(weekOf());
  assertEquals(lines[0], "Período: semana de 12 a 18 de outubro de 2026");
  for (const n of ["12", "18", "2026", "900", "550"]) assertEquals(allowedNumbers.has(n), true, n);
  assertEquals(lines.some((l) => l.startsWith("Dias com venda: 6")), true);
  const ok = validateReport({
    summary: "Na semana de 12 a 18 de outubro você vendeu R$ 900,00 e o resultado foi de R$ 550,00.",
    observations: [],
    action: "Nos próximos dias, anote cada venda.",
    limits: "Os números vêm das suas anotações.",
  }, allowedNumbers);
  assertEquals(ok.ok, true);
  const bad = validateReport({
    summary: "Na semana de 12 a 19 de outubro você vendeu R$ 900,00.", // 19 is not the week's
    observations: [], action: "Anote.", limits: "Ok.",
  }, allowedNumbers);
  assertEquals(bad.ok, false);
});

Deno.test("the model is told it is a week, and compares only with last week", () => {
  const { system, user } = promptFor(weekOf({}, {}), "doces");
  assertEquals(system.includes("leitura semanal"), true);
  assertEquals(system.includes("nesta semana que começa"), true);
  assertEquals(user.includes("Fatos da semana:"), true);
  assertEquals(user.includes("Vendas na semana anterior: R$ 600,00"), true);
});

Deno.test("the weekly fallback passes every check, in every kind of week", () => {
  const cases = [
    weekOf(),
    weekOf({ revenue_cents: 0, cogs_cents: 0, opex_cents: 0, household_cents: 0, active_days: 0 }),
    weekOf({ revenue_cents: 30_000, cogs_cents: 40_000 }), // negative
    weekOf({ household_cents: 120_000 }),
    weekOf({ active_days: 1 }),
    weekOf({}, {}), // up: 900 vs 600
    weekOf({ revenue_cents: 30_000 }, { revenue_cents: 90_000 }), // down
  ];
  for (const i of cases) {
    const r = fallbackReport(i);
    const v = validateReport(r, factsFor(i).allowedNumbers);
    assertEquals(v.ok, true, `${JSON.stringify(i.flags)}: ${v.ok ? "" : v.reasons.join("; ")}`);
    assertEquals(r.summary.startsWith("Na semana de 12 a 18 de outubro de 2026"), true);
    assertEquals(JSON.stringify(r).includes("mês"), false, JSON.stringify(r));
  }
});

Deno.test("the weekly message says week, not month", () => {
  const text = renderMessage(fallbackReport(weekOf()), "Maria", "week");
  assertEquals(text.startsWith("Oi, Maria! Aqui está a leitura da sua semana 💜"), true);
  assertEquals(text.includes("*Para esta semana:*"), true);
  // The monthly message is unchanged.
  assertEquals(renderMessage(fallbackReport(insights()), "Maria").includes("*Para as próximas duas semanas:*"), true);
});

Deno.test("coverage is said by code, under the reading", () => {
  assertEquals(coverageLine({ kept: 24, days: 30 }), "📅 Você registrou em 24 dos últimos 30 dias.");
  assertEquals(coverageLine({ kept: 9, days: 10 }), "📅 Você registrou em 9 dos 10 dias desde que começou.");
  assertEquals(coverageLine({ kept: 3, days: 5 }), null); // too early to say anything
  assertEquals(coverageLine(null), null);
  const text = renderMessage(fallbackReport(weekOf()), "Maria", "week", coverageLine({ kept: 24, days: 30 }));
  assertEquals(text.endsWith("📅 Você registrou em 24 dos últimos 30 dias."), true);
});
