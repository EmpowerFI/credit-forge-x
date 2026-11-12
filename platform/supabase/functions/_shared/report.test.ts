import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { computeInsights, type MonthFigures } from "./checkin-insights/index.ts";
import {
  adviceFacts, adviceRequest, fallbackAdvice, validateAdvice,
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
  action: "Nas próximas 2 semanas, anote cada venda no diário.",
  limits: "Os números vêm das suas anotações, então dá para confiar bem neles.",
};

Deno.test("a reading that uses only the computed figures is accepted", () => {
  const r = validateReport(good, allowed());
  assertEquals(r.ok, true);
});

Deno.test("a reading never sends her back to paper or another tool", () => {
  for (const action of [
    "Nesta semana, liste em papel os custos fixos.",
    "Nesta semana, anote cada venda no caderno.",
    "Nesta semana, monte uma planilha com os gastos.",
    "Nesta semana, use um bloco de notas para as compras.",
  ]) {
    const r = validateReport({ ...good, action }, allowed());
    assertEquals(r.ok, false, action);
  }
  // A business that sells paper goods is still named.
  assertEquals(validateReport({ ...good, observations: ["A papelaria vendeu mais no sábado."] }, allowed()).ok, true);
});

Deno.test("the fallback's actions all happen in the diary", () => {
  for (const flags of [["FIGURES_ESTIMATED"], ["COST_UNKNOWN"], ["RESULT_NEGATIVE"], []] as const) {
    const r = fallbackReport({ ...insights(), flags: [...flags] });
    assertEquals(/papel|caderno|planilha/.test(r.action), false, r.action);
  }
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

Deno.test("a week is counted on the days she opens", () => {
  // Opens two days a week (a fair): selling on both is not "few days".
  assertEquals(weekOf({ active_days: 2, open_days: 2 }).flags.includes("FEW_ACTIVE_DAYS"), false);
  assertEquals(weekOf({ active_days: 1, open_days: 2 }).flags.includes("FEW_ACTIVE_DAYS"), true);
  // Opens one day: one day selling is the whole week.
  assertEquals(weekOf({ active_days: 1, open_days: 1 }).flags.includes("FEW_ACTIVE_DAYS"), false);
  // Not said: seven, as before.
  assertEquals(weekOf({ active_days: 1 }).flags.includes("FEW_ACTIVE_DAYS"), true);
  assertEquals(weekOf({ active_days: 1 }).open_days, null);

  const { lines, allowedNumbers } = factsFor(weekOf({ active_days: 5, open_days: 5 }));
  assertEquals(lines.includes("Dias em que o negócio abre na semana: 5"), true);
  assertEquals(allowedNumbers.has("5"), true);
  assertEquals(promptFor(weekOf({ open_days: 5 })).system.includes("não são falta"), true);
});

Deno.test("open days outside a week are refused", () => {
  assertThrows(() => weekOf({ open_days: 8 }), Error, "open_days out of range");
});

Deno.test("her pay is a cost: profit is what the sales leave after it", () => {
  // Week: sales 900, costs 350 -> result 550; pay 400 -> profit 150.
  const i = weekOf({ pay_cents: 40_000 });
  assertEquals([i.result_cents, i.pay_cents, i.profit_cents], [55_000, 40_000, 15_000]);
  assertEquals(i.flags.includes("PROFIT_NEGATIVE"), false);
  const short = weekOf({ pay_cents: 70_000 });
  assertEquals(short.profit_cents, -15_000);
  assertEquals(short.flags.includes("PROFIT_NEGATIVE"), true);
  // Not said: no profit, and the old words.
  assertEquals(weekOf().profit_cents, null);

  const facts = factsFor(i);
  assertEquals(facts.profitWords, true);
  assertEquals(facts.lines.some((l) => l.startsWith("Lucro (") && l.endsWith("R$ 150,00")), true);
  assertEquals(factsFor(short).lines.some((l) => l.startsWith("Prejuízo (") && l.endsWith("R$ 150,00")), true);
  assertEquals(promptFor(i).system.includes("nunca de pró-labore"), true);

  const said = {
    summary: "Depois dos gastos e do seu salário de R$ 400,00, sobrou um lucro de R$ 150,00.",
    observations: [],
    action: "Nos próximos dias, anote cada venda.",
    limits: "Os números vêm das suas anotações.",
  };
  assertEquals(validateReport(said, facts.allowedNumbers, true).ok, true);
  // Without her pay, "lucro" is still refused; "pró-labore" always is.
  assertEquals(validateReport(said, facts.allowedNumbers, false).ok, false);
  assertEquals(validateReport({ ...said, summary: "O seu pró-labore foi de R$ 400,00." }, facts.allowedNumbers, true).ok, false);

  const fallback = fallbackReport(short);
  assertEquals(fallback.summary.includes("faltaram R$ 150,00"), true);
  assertEquals(fallbackReport(i).summary.includes("sobrou um lucro de R$ 150,00"), true);
});

// ---------------------------------------------------------------- a week's advice

const detail = {
  days_recorded: 6,
  sales_by_method: { pix: 50_000, cash: 30_000, fiado: 10_000 },
  expenses_by_category: [{ category: "stock", cents: 30_000 }, { category: "transport", cents: 5_000 }],
};

Deno.test("the advice sees where the week's money came from and went", () => {
  const f = adviceFacts(weekOf({ open_days: 6 }), detail);
  const text = f.lines.join("\n");
  assertEquals(text.includes("vendas em Pix: R$ 500,00"), true);
  assertEquals(text.includes("vendas em fiado: R$ 100,00"), true);
  assertEquals(text.includes("mercadoria ou matéria-prima: R$ 300,00"), true);
  assertEquals(text.includes("Dias registrados no diário na semana: 6"), true);
  assertEquals(f.allowedNumbers.has("500,00") && f.allowedNumbers.has("100"), true);
  // A loan instalment is named so that repeating it never trips the forbidden words.
  const debt = adviceFacts(weekOf(), { expenses_by_category: [{ category: "debt", cents: 1_000 }] });
  assertEquals(debt.lines.join(" ").includes("empréstimo"), false);
});

Deno.test("the advice is asked for with its own tool and her sector", () => {
  const { init } = adviceRequest("sk-test", "claude-haiku-5-5", weekOf({ open_days: 6 }), "doces", detail);
  const body = JSON.parse(init.body as string);
  assertEquals(body.tool_choice.name, "write_advice");
  assertEquals(body.messages[0].content.includes("Ela trabalha com: doces"), true);
  assertEquals(body.system.includes("Sebrae"), true);
});

Deno.test("good advice passes; praise and improve may be empty", () => {
  const f = adviceFacts(weekOf({ open_days: 6 }), detail);
  const ok = validateAdvice({
    summary: "Na semana, as vendas foram de R$ 900,00.",
    praise: "Você recebeu a maior parte em Pix, R$ 500,00. Muito bem!",
    improve: "",
    action: "Ofereça um doce a mais para quem paga no Pix nesta semana.",
  }, f.allowedNumbers, f.profitWords, "Estes números vêm das suas anotações.");
  assertEquals(ok.ok, true);
  if (ok.ok) {
    assertEquals(ok.report.improve, "");
    assertEquals(ok.report.observations, []);
  }
});

Deno.test("advice with an invented number, Sebrae's name or paper is refused", () => {
  const f = adviceFacts(weekOf({ open_days: 6 }), detail);
  const bad = validateAdvice({
    summary: "Você vendeu quase R$ 1.000 na semana.",
    praise: "O Sebrae recomenda e você fez!",
    improve: "Anote os gastos num caderno.",
    action: "",
  }, f.allowedNumbers, f.profitWords, "x");
  assertEquals(bad.ok, false);
  if (!bad.ok) {
    const all = bad.reasons.join(" | ");
    assertEquals(all.includes("1.000"), true);
    assertEquals(all.includes("Sebrae"), true);
    assertEquals(all.includes("caderno"), true);
    assertEquals(all.includes("action is empty"), true);
  }
});

Deno.test("the fixed-sentence advice praises a week kept in full and names what to improve", () => {
  const kept = fallbackAdvice(weekOf({ open_days: 6 }), { days_recorded: 6 });
  assertEquals(kept.praise?.startsWith("Você registrou todos os dias em que abriu"), true);
  const hard = fallbackAdvice(weekOf({ open_days: 6, cogs_cents: 200_000 }), { days_recorded: 3 });
  assertEquals((hard.improve ?? "").length > 0, true);
  assertEquals(hard.observations, []);
});
