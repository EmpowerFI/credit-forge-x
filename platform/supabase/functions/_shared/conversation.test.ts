import { assertEquals } from "jsr:@std/assert@1";
import {
  advance, type Conversation, FRESH, parseCity, parseName, parseTenure, question,
} from "./conversation.ts";

/** Walks a whole conversation, returning the row it ends on and everything said. */
function run(from: Conversation, messages: string[]) {
  let conv = from;
  const said: string[] = [];
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

const FULL = ["oi", "sim", "Dona Maria", "Campinas/SP", "bolos e salgados", "3 anos"];

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
  assertEquals(said[0].includes("SAIR"), true);
});

Deno.test("an answer that is not understood never advances the step", () => {
  // This is the whole of AC-02. If the row does not move, a reply three days
  // later lands on the same question by construction.
  const { conv: atCity } = run(FRESH, ["oi", "sim", "Maria"]);
  assertEquals(atCity.step, "city");

  for (const nonsense of ["Campinas", "aqui mesmo", "SP", "Campinas/XX", "", "   "]) {
    const turn = advance(atCity, nonsense);
    assertEquals(turn.next, atCity, `moved on: ${JSON.stringify(nonsense)}`);
    assertEquals(turn.say.length, 1);
  }
});

Deno.test("she resumes at the question she was on, days later", () => {
  const { conv } = run(FRESH, ["oi", "sim", "Maria"]);
  // Nothing in the row refers to time, so "days later" is just the next call.
  assertEquals(question(conv), advance(conv, "ajuda").say[1]);
  const after = run(conv, ["Campinas/SP", "doces", "2 anos"]);
  assertEquals(after.conv.state, "ACTIVE");
  assertEquals(after.conv.draft.name, "Maria");
});

Deno.test("SAIR works at every point, and is never an answer", () => {
  let conv = FRESH;
  for (const m of ["oi", "sim", "Maria", "Campinas/SP"]) conv = advance(conv, m).next;
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
  const { conv } = run(FRESH, ["oi", "sim", "Maria"]);
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
