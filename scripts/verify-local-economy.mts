// The Local Economy Dashboard, in both languages and at three widths.
//   npx tsx scripts/verify-local-economy.mts
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

await page.goto(`${BASE}/app/capital/local`, { waitUntil: "networkidle" });
await settle(page, 2500);

const body = await page.locator("body").innerText();
for (const probe of PT
  ? ["Economia Local", "Multiplicador Local 3 (LM3)", "A Mumbuca, em Maricá, reteve", "Taxa de retenção local", "Velocidade do capital",
     "Adicionalidade do capital global", "O que o razão guarda", "Saldos somam zero",
     "Como o capital se moveu", "Os últimos movimentos", "O que estes números não provam", "Em que as unidades se apoiam", "Toda unidade está coberta"]
  : ["Local Economy", "Local Multiplier 3", "Mumbuca, in Maricá, retained", "Local retention rate", "Capital velocity",
     "Global capital additionality", "What the ledger holds", "Balances sum to zero",
     "How the capital moved", "The last movements", "What these numbers do not prove", "What the units stand on", "Every unit is covered"])
  console.log(`${body.includes(probe) ? "ok  " : "MISS"} ${probe}`);

// From the page's own heading, so the shell's navigation does not eat the
// budget and the ledger panels are actually read.
const from = body.indexOf(PT ? "OPERAÇÃO DE CRÉDITO E CAPITAL" : "CREDIT & CAPITAL OPERATOR");
console.log("---\n" + body.slice(from < 0 ? 0 : from).split("\n").filter((l) => l.trim()).join("\n"));

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 70)}`);
  }
  return out.slice(0, 10);
});
console.log("---\noverflow@1280:", JSON.stringify(await overflow()));
await page.screenshot({ path: "/tmp/shots/local-economy.png", fullPage: true });
for (const w of [768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await settle(page, 900);
  console.log(`overflow@${w}:`, JSON.stringify(await overflow()));
}
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
