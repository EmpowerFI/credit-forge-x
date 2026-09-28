// The Capital Journey, in both languages and at three widths.
//   npx tsx scripts/verify-capital-journey.mts
import { chromium, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../src/app/lib/stories";

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const PT = process.env.UX_LOCALE === "pt";
const settle = (p: Page, ms = 1200) => p.waitForTimeout(ms);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
await context.addInitScript(
  ([k, v]) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  ["empowerfi.app.locale", PT ? "pt" : "en"] as const);
const page = await context.newPage();
const errors: string[] = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle" });
const gate = page.locator('input[type="password"]').first();
if ((await gate.count()) && (await gate.isVisible().catch(() => false))) {
  await gate.fill(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");
}
const label = PT ? "Operador de crédito / capital" : "Credit / Capital Operator";
const choice = page.getByRole("radio", { name: label, exact: true }).first();
if (await choice.count()) { await choice.click(); await settle(page, 500); }
await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
await settle(page, 4000);

await page.goto(`${BASE}/app/capital/journey`, { waitUntil: "networkidle" });
await settle(page, 2500);

const body = await page.locator("body").innerText();
for (const probe of PT
  ? ["Jornada do Capital", "Comprometido com o livro", "Chegou a um negócio", "Negociado dentro do território",
     "O capital existe", "Um negócio pede", "O motor a encaminha", "Investidores põem o dinheiro",
     "A cota vira um ativo", "Dólares viram reais", "A mesa paga a ela", "E depois", "Ele volta como stablecoin", "resgatadas de volta para reais",
     "Sem registro em cadeia", "na fila para a Solana"]
  : ["Capital Journey", "Committed to the book", "Reached a business", "Traded inside the territory",
     "Capital exists", "A business asks", "The engine routes it", "Investors put up the money",
     "The share becomes an asset", "Dollars become reais", "The desk pays her", "And then what", "It comes back as stablecoin", "redeemed back to reais",
     "Not anchored", "queued for Solana"])
  console.log(`${body.includes(probe) ? "ok  " : "MISS"} ${probe}`);

// From the page's own heading, so the shell's navigation does not eat the
// budget and the ledger panels are actually read.
const from = body.indexOf(PT ? "OPERAÇÃO DE CRÉDITO E CAPITAL" : "CREDIT & CAPITAL OPERATOR");
console.log("---\n" + body.slice(from < 0 ? 0 : from).split("\n").filter((l) => l.trim()).join("\n"));

// Following one request is the reading the demo uses, so it is checked rather
// than assumed to work because the aggregate does.
await page.getByRole("combobox").first().click();
await settle(page, 600);
const options = page.getByRole("option");
await options.nth(1).click();
await settle(page, 2500);
const focused = await page.locator("body").innerText();
const heading = PT ? "Seguindo " : "Following ";
console.log(`${focused.includes(heading) ? "ok  " : "MISS"} ${heading.trim()} <one request>`);
console.log(`${focused.includes(PT ? "estreitada a este único pedido" : "narrowed to this one request") ? "ok  " : "MISS"} the stages narrow`);
console.log("--- focused\n" + focused.slice(focused.indexOf(heading)).split("\n").filter((l) => l.trim()).slice(0, 26).join("\n"));

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 70)}`);
  }
  return out.slice(0, 10);
});
console.log("---\noverflow@1280:", JSON.stringify(await overflow()));
await page.screenshot({ path: "/tmp/shots/capital-journey.png", fullPage: true });
for (const w of [768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await settle(page, 900);
  console.log(`overflow@${w}:`, JSON.stringify(await overflow()));
}
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
