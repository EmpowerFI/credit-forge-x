// The capital-origin panel on the Capital Network page.
//   npx tsx scripts/verify-capital-origin.mts
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
const label = PT ? "Operação" : "Operations";
const choice = page.getByRole("radio", { name: label, exact: true }).first();
if (await choice.count()) { await choice.click(); await settle(page, 500); }
await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
await settle(page, 4000);

await page.goto(`${BASE}/app/capital/network`, { waitUntil: "networkidle" });
await settle(page, 2500);

const body = await page.locator("body").innerText();
for (const probe of PT
  ? ["De onde veio o capital", "Capital doméstico, e não é uma coisa só", "Capital de fora, e são duas coisas", "restando no pool", "declarados, sem baixa"]
  : ["Where the capital came from", "Domestic capital, and it is not one thing", "Capital from abroad, and it is two things", "left in the pool", "stated, undrawn"])
  console.log(`${body.includes(probe) ? "ok  " : "MISS"} ${probe}`);

const section = body.slice(body.indexOf(PT ? "De onde veio o capital" : "Where the capital came from")).split("\n").slice(0, 60);
console.log("---\n" + section.join("\n"));

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("#origin *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 70)}`);
  }
  return out.slice(0, 10);
});
console.log("---\noverflow@1280:", JSON.stringify(await overflow()));
await page.screenshot({ path: "/tmp/shots/origin.png", fullPage: true });
for (const w of [768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await settle(page, 900);
  console.log(`overflow@${w}:`, JSON.stringify(await overflow()));
}
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
