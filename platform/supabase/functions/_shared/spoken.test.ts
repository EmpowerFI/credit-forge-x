import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  draftButton, draftMessages, dueFrom, heardText, installmentsFrom, looksLikeFigures, occurrences, readInterpretation,
  sendDraftRequest, spokenCents, toolInput,
} from "./spoken.ts";

// 21 Oct 2026, 10:00 and 19:00 in São Paulo (UTC-3).
const MORNING = new Date("2026-10-21T13:00:00Z");
const EVENING = new Date("2026-10-21T22:00:00Z");

const line = (over: Record<string, unknown>) => ({
  kind: "sale", amount_quote: "", payment_method: null, category: null, paid_later: false, due_quote: null,
  installments_quote: null, ...over,
});

Deno.test("an amount said in digits", () => {
  assertEquals(spokenCents("250"), 25_000);
  assertEquals(spokenCents("R$ 250,00"), 25_000);
  assertEquals(spokenCents("250 reais"), 25_000);
  assertEquals(spokenCents("1.500"), 150_000);
  assertEquals(spokenCents("R$ 80,50"), 8_050);
  assertEquals(spokenCents("2 mil"), 200_000);
  assertEquals(spokenCents("1,5 mil"), 150_000);
});

Deno.test("an amount said in words", () => {
  assertEquals(spokenCents("duzentos e cinquenta"), 25_000);
  assertEquals(spokenCents("cento e vinte e cinco reais"), 12_500);
  assertEquals(spokenCents("mil e quinhentos"), 150_000);
  assertEquals(spokenCents("dois mil e quinhentos"), 250_000);
  assertEquals(spokenCents("2 mil e 500"), 250_000);
  assertEquals(spokenCents("vinte e cinco mil"), 2_500_000);
  assertEquals(spokenCents("dez reais e cinquenta centavos"), 1_050);
  assertEquals(spokenCents("cinquenta centavos"), 50);
  assertEquals(spokenCents("três"), 300);
});

Deno.test("what is not one amount is refused, never guessed", () => {
  assertThrows(() => spokenCents("dois três"));              // two numbers
  assertThrows(() => spokenCents("cinco três"));
  assertThrows(() => spokenCents("250 de mercadoria"));      // a word that is not an amount
  assertThrows(() => spokenCents("100 + 50"));               // a sum is the model's arithmetic
  assertThrows(() => spokenCents("1,234.56"));               // en-US, as everywhere else
  assertThrows(() => spokenCents("zero"));
  assertThrows(() => spokenCents(""));
  assertThrows(() => spokenCents("mil mil"));
  assertThrows(() => spokenCents("dez e"));
});

Deno.test("a quote is found only as whole words", () => {
  assertEquals(occurrences("50", "vendi 150 no pix"), 0);
  assertEquals(occurrences("250", "gastei 1.250 de mercadoria"), 0);
  assertEquals(occurrences("50", "paguei 50,90 de luz"), 0);
  assertEquals(occurrences("50", "vendi 50 no pix e 50 no dinheiro."), 2);
  assertEquals(occurrences("Duzentos e Cinquenta", "vendi duzentos e  cinquenta"), 1);
  assertEquals(occurrences("R$ 80", "Paguei R$ 80 de embalagem"), 1);
  assertEquals(occurrences("", "qualquer coisa"), 0);
});

Deno.test("a payment date, only as she said it", () => {
  const day = "2026-10-20";
  assertEquals(dueFrom("dia 10", day), "2026-11-10");
  assertEquals(dueFrom("dia 25", day), "2026-10-25");
  assertEquals(dueFrom("dia vinte e cinco", day), "2026-10-25");
  assertEquals(dueFrom("dia 10 de dezembro", day), "2026-12-10");
  assertEquals(dueFrom("dia 5 de março", day), "2027-03-05");
  assertEquals(dueFrom("10/11", day), "2026-11-10");
  assertEquals(dueFrom("05/01", day), "2027-01-05");
  assertEquals(dueFrom("10/11/2026", day), "2026-11-10");
  assertEquals(dueFrom("daqui a 30 dias", day), "2026-11-19");
  assertEquals(dueFrom("em quinze dias", day), "2026-11-04");
  assertEquals(dueFrom("semana que vem", day), "2026-10-27");
  assertThrows(() => dueFrom("mês que vem", day));
  assertThrows(() => dueFrom("depois", day));
  assertThrows(() => dueFrom("10/10/2026", day));   // before the day
  assertThrows(() => dueFrom("31/02", day));
  assertThrows(() => dueFrom("dia 31", "2026-11-05")); // November has no 31st, and nothing is moved for her
});

Deno.test("instalments, only as she said them", () => {
  assertEquals(installmentsFrom("3x"), 3);
  assertEquals(installmentsFrom("em 3 vezes"), 3);
  assertEquals(installmentsFrom("em três vezes"), 3);
  assertEquals(installmentsFrom("parcelado em 4"), 4);
  assertEquals(installmentsFrom("10 parcelas"), 10);
  assertThrows(() => installmentsFrom("3"));
  assertThrows(() => installmentsFrom("em 13 vezes"));
});

Deno.test("only a message with a figure goes to the model", () => {
  assertEquals(looksLikeFigures("vendi 250 no pix"), true);
  assertEquals(looksLikeFigures("vendi duzentos no pix"), true);
  assertEquals(looksLikeFigures("paguei mil de aluguel"), true);
  assertEquals(looksLikeFigures("oi, tudo bem?"), false);
  assertEquals(looksLikeFigures("vendi uma peça"), false);
});

Deno.test("a day, read and checked", () => {
  const said = "Ontem vendi 250 no pix e 120 no cartão de crédito pra receber dia 19, e paguei 600 de mercadoria no cartão em 3x, a primeira dia 10.";
  const r = readInterpretation({
    day: "yesterday",
    lines: [
      line({ amount_quote: "250", payment_method: "pix" }),
      line({ amount_quote: "120", payment_method: "credit_card", due_quote: "dia 19" }),
      line({
        kind: "expense", amount_quote: "600", payment_method: "credit_card", category: "stock", paid_later: true,
        due_quote: "dia 10", installments_quote: "3x",
      }),
    ],
    left_out: [],
  }, said, MORNING);
  assertEquals(r.day, "2026-10-20");
  assertEquals(r.daySaid, true);
  assertEquals(r.lines, [
    { kind: "sale", amount_cents: 25_000, payment_method: "pix" },
    { kind: "sale", amount_cents: 12_000, payment_method: "credit_card", due_on: "2026-11-19" },
    { kind: "expense", amount_cents: 60_000, payment_method: "credit_card", category: "stock", due_on: "2026-11-10", installments: 3 },
  ]);
  assertEquals(r.notes, []);
  assertEquals(r.refusals, []);
});

Deno.test("a figure she did not say is refused, whatever the model says", () => {
  const said = "vendi 250 no pix";
  const r = readInterpretation({
    day: "today",
    lines: [
      line({ amount_quote: "2500", payment_method: "pix" }),      // not in her words
      line({ amount_quote: "250", payment_method: "pix" }),
      line({ amount_quote: "250", payment_method: "cash" }),      // said once, used twice
    ],
    left_out: ["vendi 900 no fiado"],                              // not in her words either
  }, said, EVENING);
  assertEquals(r.lines, [{ kind: "sale", amount_cents: 25_000, payment_method: "pix" }]);
  assertEquals(r.notes, []);
  assertEquals(r.refusals.length, 4); // two amounts, the left-out quote, and a "today" she did not say
  // "today" was not said, so the hour decides -- and 19:00 is today.
  assertEquals(r.day, "2026-10-21");
  assertEquals(r.daySaid, false);
});

Deno.test("what is missing is left out and she is told, never filled in", () => {
  const said = "vendi 300, 80 no fiado, paguei 50 de algo e 200 de aluguel a prazo. o total deu 630";
  const r = readInterpretation({
    day: "unsaid",
    lines: [
      line({ amount_quote: "300", payment_method: null }),
      line({ amount_quote: "80", payment_method: "fiado" }),
      line({ kind: "expense", amount_quote: "50", payment_method: "pix", category: null }),
      line({ kind: "expense", amount_quote: "200", payment_method: "pix", category: "rent_utilities", paid_later: true }),
    ],
    left_out: ["o total deu 630"],
  }, said, MORNING);
  assertEquals(r.lines, []);
  assertEquals(r.day, "2026-10-20"); // before noon, with no day said: yesterday
  assertEquals(r.notes, [
    "Venda de R$ 300,00: faltou dizer como recebeu (Pix, dinheiro, débito, crédito ou fiado).",
    "Venda de R$ 80,00: faltou dizer quando vai receber (fiado).",
    "Gasto de R$ 50,00: faltou dizer com o quê.",
    "Gasto de R$ 200,00: faltou dizer quando vai pagar.",
    "Não registrei: «o total deu 630».",
  ]);
});

Deno.test("a draft she can read whole before she confirms", () => {
  const r = readInterpretation({
    day: "today",
    lines: [line({ amount_quote: "250", payment_method: "pix" }), line({ kind: "expense", amount_quote: "80", payment_method: "cash", category: "packaging" })],
    left_out: [],
  }, "hoje vendi 250 no pix e gastei 80 de embalagem em dinheiro", EVENING);
  const { before, body } = draftMessages(r, EVENING);
  assertEquals(before, null);
  assertEquals(body, [
    "Entendi assim, para *hoje, 21/10*:",
    "",
    "💰 *Vendas*",
    "• Pix: R$ 250,00",
    "",
    "💸 *Gastos*",
    "• Embalagem: R$ 80,00 · Dinheiro",
    "",
    "Está certo?",
  ].join("\n"));

  // Twenty lines do not fit in a button message: the list goes first, whole.
  const many = Array.from({ length: 20 }, (_, i) => `${100 + i}`);
  const long = readInterpretation({
    day: "today",
    lines: many.map((q) => line({ kind: "expense", amount_quote: q, payment_method: "debit_card", category: "rent_utilities" })),
    left_out: [],
  }, `hoje ${many.join(" ")}`, EVENING);
  const split = draftMessages(long, EVENING);
  assertEquals(long.lines.length, 20);
  assertEquals(split.body, "Está certo o resumo acima?");
  for (const q of many) assertEquals(split.before!.includes(`R$ ${q},00`), true);
});

Deno.test("the buttons say which draft, and nothing else is one", () => {
  const id = "6f1c1a8e-8f43-4c3a-9d55-0d6c1f6c9a01";
  assertEquals(draftButton(`draft_confirm:${id}`), { id, confirm: true });
  assertEquals(draftButton(`draft_discard:${id}`), { id, confirm: false });
  assertEquals(draftButton("draft_confirm:nope"), undefined);
  assertEquals(draftButton("journal_quiet_yesterday"), undefined);
  const { url, init } = sendDraftRequest("123", "5511999999999", "Está certo?", id);
  assertEquals(url, "https://graph.facebook.com/v26.0/123/messages");
  const body = JSON.parse(String(init.body));
  assertEquals(body.interactive.type, "button");
  assertEquals(body.interactive.action.buttons.map((b: { reply: { id: string; title: string } }) => b.reply), [
    { id: `draft_confirm:${id}`, title: "Confirmar" },
    { id: `draft_discard:${id}`, title: "Corrigir" },
  ]);
});

Deno.test("the model's answer is its tool call and nothing else", () => {
  assertEquals(toolInput({ content: [{ type: "text", text: "250" }] }), null);
  assertEquals(toolInput({ content: [{ type: "tool_use", name: "record_day", input: { day: "today" } }] }), { day: "today" });
  assertEquals(readInterpretation(null, "vendi 250", EVENING).lines, []);
  assertEquals(readInterpretation({ lines: "250" }, "vendi 250", EVENING).lines, []);
});

Deno.test("what she said rides on the draft, so a voice note costs one message", () => {
  const r = readInterpretation({
    day: "today",
    lines: [line({ amount_quote: "250", payment_method: "pix" })],
    left_out: [],
  }, "hoje vendi 250 no pix", EVENING);
  const heard = heardText("hoje vendi 250 no pix");
  const one = draftMessages(r, EVENING, heard);
  assertEquals(one.before, null);
  assertEquals(one.body.startsWith(`${heard}\n\nEntendi assim`), true);

  // A long transcript that does not fit above the buttons goes just before them.
  const quotes = ["101", "102", "103", "104", "105", "106"];
  const several = readInterpretation({
    day: "today",
    lines: quotes.map((q) => line({ kind: "expense", amount_quote: q, payment_method: "debit_card", category: "rent_utilities" })),
    left_out: [],
  }, `hoje ${quotes.join(" ")}`, EVENING);
  const longHeard = heardText("a".repeat(900));
  const two = draftMessages(several, EVENING, longHeard);
  assertEquals(two.before, longHeard);
  assertEquals(two.body.startsWith("Entendi assim"), true);
});
