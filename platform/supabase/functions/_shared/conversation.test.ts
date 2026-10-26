import { assertEquals } from "jsr:@std/assert@1";
import {
  advance, type Choice, type Conversation, FRESH, nextStep, parseCity, parseName, parseTenure, question, type Say,
} from "./conversation.ts";

const textOf = (s: Say) => (typeof s === "string" ? s : s.text);

/** Walks a whole conversation, returning the row it ends on and everything said. */
function run(from: Conversation, messages: string[]) {
  let conv = from;
  const said: Say[] = [];
  let completed = false;
  let consented = false;
  for (const m of messages) {
    const turn = advance(conv, m);
    conv = turn.next;
    said.push(...turn.say);
    completed = completed || Boolean(turn.completed);
    consented = consented || Boolean(turn.consented);
  }
  return { conv, said, completed, consented };
}

// Typed and tapped answers mixed, as she will: SIM to the consent, a tap on
// "Sim" to the declaration, the profile typed, the rest tapped.
const FULL = [
  "oi", "sim", "onb:adult:yes", "Dona Maria", "Campinas/SP", "bolos e salgados", "onb:since:36", "onb:cnpj:mei",
  "onb:finance:notebook",
];

Deno.test("first message to enrolled", () => {
  const { conv, completed, consented } = run(FRESH, FULL);
  assertEquals(conv.state, "ACTIVE");
  assertEquals(conv.step, null);
  assertEquals(conv.draft, {
    consented: true,
    name: "Dona Maria",
    city: "Campinas",
    state_uf: "SP",
    sector: "bolos e salgados",
    months_operating: 36,
    adult_woman: true,
    formalization: "mei",
    finance_control: "notebook",
  });
  assertEquals(completed, true);
  assertEquals(consented, true);
});

Deno.test("nothing is collected before she has agreed", () => {
  // The welcome has to be said, and said before any question.
  const { conv, said } = run(FRESH, ["oi"]);
  assertEquals(conv.state, "CONSENT");
  assertEquals(conv.draft, {});
  assertEquals(said.length, 1);
  assertEquals(textOf(said[0]).includes("SAIR"), true);
});

Deno.test("an answer that is not understood never advances the step", () => {
  // This is the whole of AC-02. If the row does not move, a reply three days
  // later lands on the same question by construction.
  const { conv: atCity } = run(FRESH, ["oi", "sim", "sim", "Maria"]);
  assertEquals(atCity.step, "city");

  for (const nonsense of ["Campinas", "aqui mesmo", "SP", "Campinas/XX", "", "   "]) {
    const turn = advance(atCity, nonsense);
    assertEquals(turn.next, atCity, `moved on: ${JSON.stringify(nonsense)}`);
    assertEquals(turn.say.length, 1);
  }
});

Deno.test("she resumes at the question she was on, days later", () => {
  const { conv } = run(FRESH, ["oi", "sim", "sim", "Maria"]);
  // Nothing in the row refers to time, so "days later" is just the next call.
  assertEquals(question(conv), advance(conv, "ajuda").say[1]);
  const after = run(conv, ["Campinas/SP", "doces", "2 anos", "não tenho", "planilha"]);
  assertEquals(after.conv.state, "ACTIVE");
  assertEquals(after.conv.draft.name, "Maria");
});

Deno.test("SAIR works at every point, and is never an answer", () => {
  let conv = FRESH;
  for (const m of ["oi", "sim", "sim", "Maria", "Campinas/SP"]) conv = advance(conv, m).next;
  for (const at of [FRESH, conv]) {
    const turn = advance(at, "sair");
    assertEquals(turn.next.state, "OPTED_OUT");
    assertEquals(turn.say.length, 1);
  }
  // And it is not mistaken for a name or a sector.
  const { next } = advance({ state: "PROFILE", step: "name", draft: {} }, "SAIR");
  assertEquals(next.state, "OPTED_OUT");
});

Deno.test("coming back after leaving starts from consent, not where she stopped", () => {
  // A withdrawn consent is not quietly reinstated by her saying hello.
  const left = advance({ state: "PROFILE", step: "sector", draft: { name: "Maria" } }, "sair").next;
  assertEquals(left.state, "OPTED_OUT");
  const back = advance(left, "oi");
  assertEquals(back.next.state, "CONSENT");
  assertEquals(back.next.draft, {});
});

Deno.test("AJUDA explains and repeats the question without moving", () => {
  const { conv } = run(FRESH, ["oi", "sim", "sim", "Maria"]);
  const turn = advance(conv, "ajuda");
  assertEquals(turn.next, conv);
  assertEquals(turn.say.length, 2);
  assertEquals(turn.say[1], question(conv));
});

Deno.test("a consent that is not a yes is not a consent", () => {
  for (const answer of ["talvez", "o que e isso", "nao", "depois"]) {
    const turn = advance({ state: "CONSENT", step: null, draft: {} }, answer);
    assertEquals(turn.next.state, "CONSENT");
    assertEquals(turn.consented, undefined);
    assertEquals(turn.next.draft.consented, undefined);
  }
});

Deno.test("writing again once enrolled does not restart anything", () => {
  const { conv } = run(FRESH, FULL);
  const turn = advance(conv, "oi");
  assertEquals(turn.next, conv);
  assertEquals(turn.completed, undefined);
});

Deno.test("cidade e estado, as people write them", () => {
  assertEquals(parseCity("Campinas/SP"), { city: "Campinas", uf: "SP" });
  assertEquals(parseCity("Campinas - SP"), { city: "Campinas", uf: "SP" });
  assertEquals(parseCity("campinas sp"), { city: "campinas", uf: "SP" });
  assertEquals(parseCity("São Paulo, SP"), { city: "São Paulo", uf: "SP" });
  assertEquals(parseCity("Rio de Janeiro/rj"), { city: "Rio de Janeiro", uf: "RJ" });
  assertEquals(parseCity("Campinas"), null);
  assertEquals(parseCity("Campinas/XX"), null); // not a state
  assertEquals(parseCity("SP"), null);
});

Deno.test("tempo de operacao: understood, unknown, and not understood are three things", () => {
  assertEquals(parseTenure("3 anos"), 36);
  assertEquals(parseTenure("1 ano"), 12);
  assertEquals(parseTenure("8 meses"), 8);
  assertEquals(parseTenure("1 mes"), 1);
  assertEquals(parseTenure("2 anos e 6 meses"), 30);
  assertEquals(parseTenure("5"), 60); // a bare number is years, as people say it
  // "I do not know" is an answer and moves her on.
  assertEquals(parseTenure("não sei"), null);
  assertEquals(parseTenure("NAO SEI"), null);
  // Not understood: ask again. Undefined, never null -- merging the two would
  // record "she does not know" for an answer nobody read.
  assertEquals(parseTenure("desde a pandemia"), undefined);
  assertEquals(parseTenure(""), undefined);
  assertEquals(parseTenure("0 anos"), undefined);
  assertEquals(parseTenure("900 anos"), undefined);
});

Deno.test("a name is a name", () => {
  assertEquals(parseName("Dona Maria"), "Dona Maria");
  assertEquals(parseName("  maria   josé  "), "maria josé");
  assertEquals(parseName("M"), null);
  assertEquals(parseName("123"), null);
  assertEquals(parseName("sim"), null);   // never a command
  assertEquals(parseName("ajuda"), null);
  assertEquals(parseName("x".repeat(81)), null);
});

Deno.test("the declaration comes first, and a no keeps nothing", () => {
  const { conv, said } = run(FRESH, ["oi", "sim"]);
  assertEquals(conv.step, "adult");
  const ask = said[said.length - 1] as Choice;
  assertEquals(ask.options.map((o) => o.id), ["onb:adult:yes", "onb:adult:no"]);

  const no = advance(conv, "onb:adult:no");
  assertEquals(no.next, FRESH);              // nothing she answered is kept
  assertEquals(no.completed, undefined);
  assertEquals(textOf(no.say[0]).includes("18 anos"), true);
  assertEquals(advance(no.next, "oi").next.state, "CONSENT"); // writing again starts over

  assertEquals(advance(conv, "não").next, FRESH);
  assertEquals(advance(conv, "talvez").next, conv); // not understood: asked again
  assertEquals(advance(conv, "sim").next.step, "name");
});

Deno.test("CNPJ and how she keeps the money, tapped or typed", () => {
  const atCnpj: Conversation = {
    state: "PROFILE", step: "cnpj",
    draft: { consented: true, adult_woman: true, name: "Rosa", city: "Osasco", state_uf: "SP", sector: "marmitas", months_operating: 12 },
  };
  for (const [answer, value] of [["onb:cnpj:mei", "mei"], ["onb:cnpj:cnpj", "cnpj"], ["onb:cnpj:none", "none"],
    ["Sou MEI", "mei"], ["não tenho", "none"], ["tenho CNPJ", "cnpj"]] as const) {
    assertEquals(advance(atCnpj, answer).next.draft.formalization, value, answer);
  }
  // A "no" inside the answer is never read as the word next to it.
  assertEquals(advance(atCnpj, "não sou mei").next, atCnpj);
  assertEquals(advance(atCnpj, "onb:cnpj:talvez").next, atCnpj);

  const atFinance = advance(atCnpj, "onb:cnpj:none").next;
  assertEquals(atFinance.step, "finance");
  for (const [answer, value] of [["onb:finance:spreadsheet", "spreadsheet"], ["anoto no caderno", "notebook"],
    ["uso um aplicativo", "app"], ["de cabeça", "memory"], ["não controlo", "none"]] as const) {
    const turn = advance(atFinance, answer);
    assertEquals(turn.next.draft.finance_control, value, answer);
    assertEquals(turn.completed, true);
  }
});

Deno.test("tenure from the list is the lower bound of what she chose", () => {
  const atSince: Conversation = { state: "PROFILE", step: "since", draft: { consented: true, adult_woman: true, name: "R", city: "X", state_uf: "SP", sector: "doces" } };
  assertEquals(advance(atSince, "onb:since:1").next.draft.months_operating, 1);
  assertEquals(advance(atSince, "onb:since:60").next.draft.months_operating, 60);
  assertEquals(advance(atSince, "onb:since:unknown").next.draft.months_operating, null);
  assertEquals(advance(atSince, "4 anos").next.draft.months_operating, 48);
  assertEquals(advance(atSince, "onb:since:0").next, atSince); // outside the column's range
});

Deno.test("a conversation begun before the new questions still asks them", () => {
  // At the old last step, with no declaration, CNPJ or finance answer yet.
  const old: Conversation = { state: "PROFILE", step: "since", draft: { consented: true, name: "Rosa", city: "Osasco", state_uf: "SP", sector: "doces" } };
  const turn = advance(old, "2 anos");
  assertEquals(turn.completed, undefined);
  assertEquals(turn.next.step, "adult");
  assertEquals(nextStep({ ...turn.next.draft, adult_woman: true }), "cnpj");
});

Deno.test("every option fits Meta's limits", () => {
  const { said } = run(FRESH, FULL.slice(0, -1));
  for (const s of said) {
    if (typeof s === "string") continue;
    for (const o of s.options) assertEquals(o.title.length <= (s.list ? 24 : 20), true, o.title);
    assertEquals(s.options.length <= (s.list ? 10 : 3), true);
  }
});
