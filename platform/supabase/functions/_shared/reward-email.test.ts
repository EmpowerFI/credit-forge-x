import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { because, outcomeOf, resendRequest, rewardEmail, type RewardEmail } from "./reward-email.ts";

const live = (over: Partial<RewardEmail> = {}): RewardEmail => ({
  id: "6c1f0a8e-0000-4000-8000-000000000001",
  email: "maria@exemplo.com",
  name: "Maria da Silva",
  title: "Live 1",
  how_to_redeem: "Terça, 8/12, às 19h",
  redeem_url: "https://meet.example/abc?x=1&y=2",
  campaign_name: "Desafio 30 dias",
  sponsor_name: "conta.vc",
  is_house: false,
  threshold_days: 10,
  ...over,
});

Deno.test("the e-mail says what she won, how, the link, and why she gets it", () => {
  const { subject, text, html } = rewardEmail(live());
  assertEquals(subject, "Sua recompensa: Live 1");
  assert(text.startsWith("Olá, Maria!"));
  assert(text.includes("Terça, 8/12, às 19h"));
  assert(text.includes("Link: https://meet.example/abc?x=1&y=2"));
  assert(text.includes("na campanha Desafio 30 dias, de conta.vc"));
  assert(text.trimEnd().endsWith("EmpowerFI"));
  assert(html.includes('lang="pt-BR"'));
  assert(html.includes('href="https://meet.example/abc?x=1&amp;y=2"'));
});

Deno.test("what she or a sponsor typed is escaped in the HTML", () => {
  const { html } = rewardEmail(live({ title: "<script>x</script>", sponsor_name: "A & B" }));
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("A &amp; B"));
});

Deno.test("EmpowerFI's own reward names no campaign; no name, a plain hello", () => {
  assertEquals(because(live({ is_house: true, threshold_days: 1 })),
    "Você recebeu este e-mail porque ganhou esta recompensa ao registrar 1 dia no seu diário da EmpowerFI.");
  assert(rewardEmail(live({ name: "  " })).text.startsWith("Olá!\n"));
});

Deno.test("nothing is built without an https link or an address", () => {
  assertThrows(() => rewardEmail(live({ redeem_url: null })));
  assertThrows(() => rewardEmail(live({ redeem_url: "http://meet.example" })));
  assertThrows(() => resendRequest("k", "EmpowerFI <noreply@empowerfi.io>", live({ email: null })));
});

Deno.test("the request to Resend, once per e-mail", () => {
  const { url, init } = resendRequest("k", "EmpowerFI <noreply@empowerfi.io>", live());
  assertEquals(url, "https://api.resend.com/emails");
  const headers = init.headers as Record<string, string>;
  assertEquals(headers["Idempotency-Key"], "reward-email-6c1f0a8e-0000-4000-8000-000000000001");
  const body = JSON.parse(String(init.body));
  assertEquals(body.to, ["maria@exemplo.com"]);
  assert(typeof body.text === "string" && typeof body.html === "string");
});

Deno.test("Resend's answer, as recorded: never her address", async () => {
  assertEquals(await outcomeOf(new Response(JSON.stringify({ id: "re_1" }), { status: 200 })), { id: "re_1", error: null });
  const bad = await outcomeOf(new Response(JSON.stringify({ name: "validation_error", message: "maria@exemplo.com is invalid" }), { status: 422 }));
  assertEquals(bad, { id: null, error: "resend 422 validation_error" });
  assertEquals((await outcomeOf(new Response("oops", { status: 500 }))).error, "resend 500 error");
});
