import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  addDays, buttonReplies, CATEGORIES, confirmationText, earnedText, EXPENSE_SCREENS, isAuthorise, isJournalReply,
  isQuietText, type Milestone, span,
  journalFlow, JOURNAL_FORM, mondayOf, parseJournalReply, weekToRead, pickedDate, QUIET_YESTERDAY, sendFlowRequest, spDate,
} from "./journal.ts";

// 15 Oct 2026, 09:10 in São Paulo (UTC-3): the reminder has just gone out.
const MORNING = new Date("2026-10-15T12:10:00Z");
// 14 Oct 2026, 22:30 in São Paulo -- already the 15th in UTC.
const LATE_EVENING = new Date("2026-10-15T01:30:00Z");

const form = (over: Record<string, unknown> = {}) => JSON.stringify({ form: JOURNAL_FORM, day: "yesterday", ...over });

Deno.test("the day is São Paulo's, not the server's", () => {
  assertEquals(spDate(MORNING), "2026-10-15");
  assertEquals(spDate(LATE_EVENING), "2026-10-14");
  assertEquals(addDays("2026-11-01", -1), "2026-10-31");
  assertEquals(addDays("2026-03-01", -1), "2026-02-28");
});

Deno.test("yesterday is the default, and it is the day before she pressed send", () => {
  assertEquals(parseJournalReply(form({ sale_pix: "10" }), MORNING).day, "2026-10-14");
  assertEquals(parseJournalReply(form({ day: "today", sale_pix: "10" }), MORNING).day, "2026-10-15");
  // Sent at 22:30 on the 14th: "hoje" is the 14th, though the server's clock says the 15th.
  assertEquals(parseJournalReply(form({ day: "today", sale_pix: "10" }), LATE_EVENING).day, "2026-10-14");
  assertThrows(() => parseJournalReply(form({ day: "anteontem", sale_pix: "10" }), MORNING), Error, "hoje ou de ontem");
});

Deno.test("a full day, line by line", () => {
  const { lines } = parseJournalReply(form({
    sale_pix: "230",
    sale_cash: "45,50",
    sale_debit: "",
    sale_credit: "120",
    sale_credit_due: "2026-11-13",
    sale_fiado: "60",
    sale_fiado_due: "2026-10-30",
    exp1_category: "stock", exp1_amount: "80", exp1_method: "cash", exp1_paid_now: "yes",
    exp2_category: "fees", exp2_amount: "4,20", exp2_method: "credit_card", exp2_paid_now: "no", exp2_due: "2026-11-10",
  }), MORNING);
  assertEquals(lines, [
    { kind: "sale", amount_cents: 23_000, payment_method: "pix" },
    { kind: "sale", amount_cents: 4_550, payment_method: "cash" },
    { kind: "sale", amount_cents: 12_000, payment_method: "credit_card", due_on: "2026-11-13" },
    { kind: "sale", amount_cents: 6_000, payment_method: "fiado", due_on: "2026-10-30" },
    { kind: "expense", amount_cents: 8_000, payment_method: "cash", category: "stock" },
    { kind: "expense", amount_cents: 420, payment_method: "credit_card", category: "fees", due_on: "2026-11-10" },
  ]);
});

Deno.test("money still to come must say when", () => {
  assertThrows(() => parseJournalReply(form({ sale_credit: "120" }), MORNING), Error, "quando vai receber");
  assertThrows(() => parseJournalReply(form({ sale_fiado: "60", sale_fiado_due: "2026-10-14" }), MORNING), Error, "depois do dia");
  assertThrows(
    () => parseJournalReply(form({ exp1_category: "stock", exp1_amount: "80", exp1_method: "fiado", exp1_paid_now: "no" }), MORNING),
    Error, "quando vai pagar",
  );
  // An expense paid now carries no date, even if one was left behind in the form.
  const { lines } = parseJournalReply(
    form({ exp1_category: "stock", exp1_amount: "80", exp1_method: "pix", exp1_paid_now: "yes", exp1_due: "2026-12-01" }),
    MORNING,
  );
  assertEquals(lines[0].due_on, undefined);
});

Deno.test("an expense is whole or it is refused", () => {
  assertThrows(() => parseJournalReply(form({ exp1_amount: "80", exp1_method: "pix" }), MORNING), Error, "falta o tipo");
  assertThrows(() => parseJournalReply(form({ exp1_category: "stock", exp1_method: "pix" }), MORNING), Error, "falta o valor");
  assertThrows(() => parseJournalReply(form({ exp1_category: "stock", exp1_amount: "80" }), MORNING), Error, "como pagou");
  assertThrows(() => parseJournalReply(form({ exp1_category: "lunch", exp1_amount: "80", exp1_method: "pix" }), MORNING), Error, "tipo desconhecido");
  assertThrows(() => parseJournalReply(form({ exp1_category: "stock", exp1_amount: "0", exp1_method: "pix" }), MORNING), Error, "valor zero");
  // An untouched expense screen -- defaults still set -- is no expense at all.
  assertEquals(parseJournalReply(form({ sale_pix: "10", exp1_paid_now: "yes", exp1_method: "" }), MORNING).lines.length, 1);
});

Deno.test("refusals are written for her, never for us", () => {
  for (const [over, words] of [
    [{ sale_pix: "1,234.56" }, "Pix: não consegui ler o valor"],
    [{ sale_credit: "10", sale_credit_due: "amanhã" }, "Cartão de crédito: não consegui ler a data"],
    [{ exp1_category: "stock", exp1_amount: "dez", exp1_method: "pix" }, "gasto 1: não consegui ler o valor"],
  ] as const) {
    assertThrows(() => parseJournalReply(form(over), MORNING), Error, words);
  }
  assertThrows(() => parseJournalReply("{", MORNING), Error, "chegou incompleto");
});

Deno.test("zero in a sales box is no sale; an empty form is empty, not a quiet day", () => {
  assertEquals(parseJournalReply(form({ sale_pix: "0", sale_cash: "" }), MORNING).lines, []);
});

Deno.test("dates from either Flow version", () => {
  assertEquals(pickedDate("2026-11-13"), "2026-11-13");
  // Older versions send milliseconds; midnight in São Paulo is 03:00 UTC.
  assertEquals(pickedDate(String(Date.UTC(2026, 10, 13, 3, 0))), "2026-11-13");
  assertEquals(pickedDate(Date.UTC(2026, 10, 13, 3, 0)), "2026-11-13");
  assertThrows(() => pickedDate("2026-02-30"));
  assertThrows(() => pickedDate("13/11/2026"));
});

Deno.test("only the daily form is the daily form", () => {
  assertEquals(isJournalReply(form()), true);
  assertEquals(isJournalReply(JSON.stringify({ flow_token: "tok", revenue_brl: "10" })), false);
  assertEquals(isJournalReply("not json"), false);
});

Deno.test("a quiet day, in words", () => {
  for (const t of ["SEM MOVIMENTO", "sem movimento.", "Não teve movimento", "ontem não teve movimento!"]) {
    assertEquals(isQuietText(t), true, t);
  }
  for (const t of ["sem movimento ontem, mas hoje vendi 50", "movimento", "oi"]) assertEquals(isQuietText(t), false, t);
});

Deno.test("the reminder's quick reply, from a template and from an interactive message", () => {
  const body = {
    entry: [{
      changes: [{
        value: {
          messages: [
            { id: "w1", from: "5511987654321", timestamp: "1792066200", type: "button", button: { payload: QUIET_YESTERDAY, text: "Ontem não teve movimento" } },
            { id: "w2", from: "5511987654321", timestamp: "1792066200", type: "interactive", interactive: { type: "button_reply", button_reply: { id: QUIET_YESTERDAY } } },
            { id: "w3", from: "5511987654321", type: "text", text: { body: "oi" } },
          ],
        },
      }],
    }],
  };
  const got = buttonReplies(body);
  assertEquals(got.map((b) => [b.messageId, b.payload]), [["w1", QUIET_YESTERDAY], ["w2", QUIET_YESTERDAY]]);
  assertEquals(got[0].sentAt.toISOString(), new Date(1792066200 * 1000).toISOString());
});

Deno.test("what she reads back", () => {
  const text = confirmationText("2026-10-14", MORNING, {
    quiet: false, sales_cents: 15_000, expenses_cents: 4_150, week_kept: 3, week_days: 3,
  });
  assertEquals(text.startsWith("Registrado ✅ Ontem: R$ 150,00 em vendas e R$ 41,50 em gastos."), true);
  assertEquals(text.includes("todos os 3 dias desta semana"), true);
  const gap = confirmationText("2026-10-15", MORNING, { quiet: true, sales_cents: 0, expenses_cents: 0, week_kept: 3, week_days: 4 });
  assertEquals(gap.startsWith("Anotado ✅ Hoje não teve movimento."), true);
  assertEquals(gap.includes("3 de 4 dias"), true);
});

Deno.test("the streak, and what is next", () => {
  const summary = { quiet: false, sales_cents: 15_000, expenses_cents: 0, week_kept: 2, week_days: 3 };
  const text = confirmationText("2026-10-14", MORNING, summary, {
    streak_days: 5, streak_started_on: "2026-10-10", earned: [],
    next: { code: "week1", title: "Presente da semana 1", kind: "perk", threshold_days: 7, days_left: 2 },
  });
  assertEquals(text.includes("🔥 5 dias seguidos registrando."), true);
  assertEquals(text.includes("Faltam 2 dias para: Presente da semana 1."), true);
  // The week count is the fallback when there is no progress to report.
  assertEquals(confirmationText("2026-10-14", MORNING, summary, null).includes("2 de 3 dias"), true);
  // Everything earned: no "faltam".
  const done = confirmationText("2026-10-14", MORNING, summary, { streak_days: 90, streak_started_on: "2026-07-01", earned: [], next: null });
  assertEquals(done.includes("Faltam"), false);
});

Deno.test("spans read the way she would say them", () => {
  assertEquals(span(7), "1 semana");
  assertEquals(span(14), "2 semanas");
  assertEquals(span(28), "4 semanas");
  assertEquals(span(60), "60 dias");
  assertEquals(span(1), "1 dia");
});

const perk: Milestone = {
  code: "week1", kind: "perk", title: "Presente da semana 1", how_to_redeem: "A equipe vai falar com você.",
  partner_name: null, threshold_days: 7, status: "granted",
};
const card: Milestone = {
  code: "day60", kind: "partner_benefit", title: "Oferta de cartão de crédito", how_to_redeem: "O parceiro vai entrar em contato.",
  partner_name: "Banco Exemplo", threshold_days: 60, status: "awaiting_consent",
};

Deno.test("a perk is announced with how to get it", () => {
  const t = earnedText(perk);
  assertEquals(t.startsWith("🎁 Você completou 1 semana registrando o seu negócio!"), true);
  assertEquals(t.includes("*Presente da semana 1*"), true);
  assertEquals(t.includes("A equipe vai falar com você."), true);
});

Deno.test("a partner's benefit says whose it is, who decides, and asks before sharing", () => {
  const waiting = earnedText(card);
  assertEquals(waiting.includes("uma oferta de Banco Exemplo"), true);
  assertEquals(waiting.includes("Quem analisa e decide a oferta é Banco Exemplo, não a EmpowerFI."), true);
  assertEquals(waiting.includes("AUTORIZO"), true);
  assertEquals(waiting.includes("vai entrar em contato"), false); // nothing happens until she says yes
  for (const promise of ["aprovad", "garant", "limite de"]) assertEquals(waiting.toLowerCase().includes(promise), false, promise);

  const released = earnedText({ ...card, status: "granted" });
  assertEquals(released.includes("AUTORIZO"), false);
  assertEquals(released.includes("O parceiro vai entrar em contato."), true);
  assertEquals(released.includes("não a EmpowerFI"), true);
});

Deno.test("AUTORIZO, and only that", () => {
  for (const t of ["AUTORIZO", "autorizo.", "Eu autorizo", "sim, autorizo!"]) assertEquals(isAuthorise(t), true, t);
  for (const t of ["não autorizo", "autorizo depois", "sim"]) assertEquals(isAuthorise(t), false, t);
});

Deno.test("the form is opened with our token and its first screen", () => {
  const { init } = sendFlowRequest("123", "+5511987654321", "999", "Registro do dia");
  const body = JSON.parse(String(init.body));
  assertEquals(body.interactive.type, "flow");
  assertEquals(body.interactive.action.parameters.flow_token, JOURNAL_FORM);
  assertEquals(body.interactive.action.parameters.flow_action_payload.screen, "VENDAS");
});

// ------------------------------------------------------------- form vs reader

type Node = Record<string, unknown>;
const walk = (n: unknown, out: Node[] = []): Node[] => {
  if (Array.isArray(n)) n.forEach((c) => walk(c, out));
  else if (n && typeof n === "object") {
    out.push(n as Node);
    Object.values(n as Node).forEach((c) => walk(c, out));
  }
  return out;
};

Deno.test("the published form is exactly the one this code reads", async () => {
  const onDisk = JSON.parse(await Deno.readTextFile(new URL("../../../../docs/whatsapp/diario-flow.pt-BR.json", import.meta.url)));
  assertEquals(onDisk, journalFlow(), "regenerate with: npx tsx scripts/whatsapp/build-diario-flow.mts");
});

Deno.test("every field the reader needs reaches the final payload, from every screen", () => {
  const flow = journalFlow() as { screens: Node[] };
  assertEquals(flow.screens.length, 1 + EXPENSE_SCREENS);
  const needed = (n: number) => [
    "day", "sale_pix", "sale_cash", "sale_debit", "sale_credit", "sale_credit_due", "sale_fiado", "sale_fiado_due",
    ...Array.from({ length: n }, (_, i) => [`exp${i + 1}_category`, `exp${i + 1}_amount`, `exp${i + 1}_method`, `exp${i + 1}_paid_now`, `exp${i + 1}_due`]).flat(),
  ];
  for (let n = 1; n <= EXPENSE_SCREENS; n++) {
    const screen = flow.screens[n];
    const complete = walk(screen).find((x) => x.name === "complete") as { payload: Record<string, string> };
    assertEquals(complete.payload.form, JOURNAL_FORM);
    for (const f of needed(n)) assertEquals(f in complete.payload, true, `GASTO_${n} complete lacks ${f}`);
  }
  // The dropdown offers exactly the categories the database accepts.
  const dropdown = walk(flow.screens[1]).find((x) => x.name === "exp1_category") as { "data-source": { id: string }[] };
  assertEquals(dropdown["data-source"].map((d) => d.id), CATEGORIES.map((c) => c.id));
});

Deno.test("which week a recorded day closes", () => {
  assertEquals(mondayOf("2026-10-18"), "2026-10-12"); // Sunday
  assertEquals(mondayOf("2026-10-12"), "2026-10-12"); // Monday
  assertEquals(mondayOf("2026-11-01"), "2026-10-26"); // across months
  // Sunday, recorded on Monday morning: its own week.
  assertEquals(weekToRead("2026-10-18"), "2026-10-12");
  // Any other day: the week before, in case Sunday never came.
  assertEquals(weekToRead("2026-10-19"), "2026-10-12");
  assertEquals(weekToRead("2026-10-21"), "2026-10-12");
});
