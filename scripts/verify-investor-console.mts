// The investor console, in both languages and at three widths: it allocates in
// USDC and offers nothing in reais.
//   npx tsx scripts/verify-investor-console.mts
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
const label = PT ? "Investidor / Fundo de impacto" : "Investor / Impact Fund";
const choice = page.getByRole("radio", { name: label, exact: true }).first();
if (await choice.count()) { await choice.click(); await settle(page, 500); }
await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
await settle(page, 4000);

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
    // A container that scrolls on purpose is not a layout break.
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")
        || el.classList.contains("overflow-x-auto")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 70)}`);
  }
  return out.slice(0, 10);
});

// What must be there, and what must not be anywhere in the console.
const GONE = PT
  ? ["Doméstico / Pix", "Simular uma alocação em reais", "Capacidade doméstica", "P2P Doméstico", "como estão os dois pools", "Rota:"]
  : ["Domestic / Pix", "Simulate a BRL allocation", "Domestic capacity", "Domestic P2P", "where the two pools stand", "Route:"];

for (const [path, wanted] of [
  ["/app/investor", PT
    ? ["Captando agora", "Conecte a sua carteira na barra do topo para investir em USDC", "Como seu capital se moveu"]
    : ["Raising now", "Connect your own wallet from the top bar to invest in USDC", "How your capital moved"]],
  ["/app/investor/portfolio", PT
    ? ["Todas as suas posições", "Principal", "Global / USDC"]
    : ["Every position you hold", "Principal", "Global / USDC"]],
  ["/app/investor/opportunities", PT
    ? ["Pedidos qualificados captando em USDC agora", "estão captando em reais na mesa doméstica"]
    : ["Qualified requests raising in USDC now", "are raising in reais on the domestic desk"]],
] as [string, string[]][]) {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await settle(page, 2500);
  const body = await page.locator("main").innerText();
  console.log(`\n=== ${path}`);
  for (const probe of wanted) console.log(`${body.includes(probe) ? "ok  " : "MISS"} ${probe}`);
  for (const probe of GONE) console.log(`${body.includes(probe) ? "STILL THERE" : "ok   gone"}: ${probe}`);
  console.log("overflow@1280:", JSON.stringify(await overflow()));
  for (const w of [768, 390]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await settle(page, 900);
    console.log(`overflow@${w}:`, JSON.stringify(await overflow()));
  }
}

// Every opportunity the console offers is one it can fund in USDC.
await page.setViewportSize({ width: 1280, height: 1100 });
await page.goto(`${BASE}/app/investor/opportunities`, { waitUntil: "networkidle" });
await settle(page, 2500);
const cards = await page.locator("main ul > li").count();
const first = page.locator("main ul > li a[href^='/app/investor/opportunities/']").first();
const href = await first.getAttribute("href");
await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
await settle(page, 2500);
const detail = await page.locator("main").innerText();
console.log(`\n=== ${href} (of ${cards} listed)`);
for (const probe of PT ? ["Investir", "Global / USDC"] : ["Invest", "Global / USDC"]) {
  console.log(`${detail.includes(probe) ? "ok  " : "MISS"} ${probe}`);
}
// The detail page names both pools on purpose: the engine's comparison is why
// a dollar is needed here at all, and that is an explanation, not an offer.
for (const probe of GONE.filter((g) => !/Domestic P2P|P2P Doméstico/.test(g))) {
  console.log(`${detail.includes(probe) ? "STILL THERE" : "ok   gone"}: ${probe}`);
}
console.log("overflow@1280:", JSON.stringify(await overflow()));

console.log("\nconsole errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
