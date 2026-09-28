// What every number here is made of, plus the mark it puts on other screens.
//   npx tsx scripts/verify-evidence.mts
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

await page.goto(`${BASE}/app/evidence`, { waitUntil: "networkidle" });
await settle(page, 2500);

const body = await page.locator("body").innerText();
for (const probe of PT
  ? ["De que é feito cada número daqui", "As quatro palavras", "Família por família",
     "Três marcas, três perguntas diferentes", "Observado", "De um parceiro", "Simulado", "Referência externa",
     "Os meses que um negócio informa", "Registros ancorados na Solana", "O trilho de capital produtivo local",
     "O que este produto pode afirmar"]
  : ["What every number here is made of", "The four words", "Family by family",
     "Three marks, three different questions", "Observed", "From a partner", "Simulated", "External benchmark",
     "The months a business reports", "Records anchored on Solana", "The local productive capital rail",
     "What this product may claim"])
  console.log(`${body.includes(probe) ? "ok  " : "MISS"} ${probe}`);

const from = body.indexOf(PT ? "De que é feito" : "What every number here");
console.log("---\n" + body.slice(from < 0 ? 0 : from).split("\n").filter((l) => l.trim()).slice(0, 40).join("\n"));

// The mark this page explains has to be on the screens it explains.
// Three screens this persona can actually open. Her own page carries the same
// mark, but the operator cannot open it, so checking it here would only ever
// prove that the route is role-gated.
for (const [path, name] of [["/app/capital/engine", "engine"], ["/app/capital/local", "local economy"], ["/app/capital/economics", "operating economics"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await settle(page, 2500);
  const t = await page.locator("body").innerText();
  // The shell already says "Simulated data", so look for the tag's own tooltip
  // text: only the evidence mark carries it.
  const mark = await page.locator('[title*="prototype from assumptions"], [title*="protótipo a partir de premissas"]').count();
  console.log(`${mark > 0 ? "ok  " : "MISS"} ${name} carries an evidence mark`);
}
await page.goto(`${BASE}/app/evidence`, { waitUntil: "networkidle" });
await settle(page, 2000);

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 70)}`);
  }
  return out.slice(0, 10);
});
console.log("---\noverflow@1280:", JSON.stringify(await overflow()));
await page.screenshot({ path: "/tmp/shots/evidence.png", fullPage: true });
for (const w of [768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await settle(page, 900);
  console.log(`overflow@${w}:`, JSON.stringify(await overflow()));
}
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
