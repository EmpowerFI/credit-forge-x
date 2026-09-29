// The engine leaves the menus and is reached from the money it explains.
//   npx tsx scripts/verify-engine-contextual.mts
import { chromium, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../src/app/lib/stories";

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const PT = process.env.UX_LOCALE === "pt";
const settle = (p: Page, ms = 1500) => p.waitForTimeout(ms);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* private */ } },
  ["empowerfi.app.locale", PT ? "pt" : "en"] as const);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

const gateIn = async () => {
  const gate = page.locator('input[type="password"]').first();
  if ((await gate.count()) && (await gate.isVisible().catch(() => false))) {
    await gate.fill(DEMO_PASSWORD); await page.keyboard.press("Enter"); await page.waitForLoadState("networkidle");
  }
};
// Signed in once, as the sponsor's demo account; ?as= renders any view's tools
// without signing in again, and a page belonging to another persona offers that
// persona's demo account on its refusal.
await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle" });
await gateIn();
await settle(page, 1200);
await page.getByRole("button", { name: /Enter as demo|Entrar como demo/i }).first().click();
await settle(page, 4000);

// Becoming another view's demo persona: the start page offers that persona's
// account even when a different demo account is already signed in.
const becomeDemo = async (view: string) => {
  await page.goto(`${BASE}/app/start?as=${view}`, { waitUntil: "networkidle" });
  await settle(page, 1500);
  const enter = page.getByRole("button", { name: /Enter as demo|Entrar como demo|Enter as the demo|Entrar como/i }).first();
  if (await enter.count()) { await enter.click(); await settle(page, 5000); }
  else console.log(`     (no demo button on start?as=${view})`);
};

const open = async (path: string) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await settle(page, 2500);
  const swap = page.getByRole("button", { name: /Enter as the demo|Entrar como/i }).first();
  if (await swap.count()) {
    await swap.click();
    await settle(page, 5000);
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await settle(page, 2500);
  }
};

// 1. The engine is in nobody's menu, and not in the numbered bar.
const GONE = PT ? ["Como funciona", "Motor de Crédito e Capital"] : ["How it works", "Credit & Capital Engine"];
for (const view of ["sponsor", "investor", "operator", "community", "entrepreneur"]) {
  await page.goto(`${BASE}/app/start?as=${view}`, { waitUntil: "networkidle" });
  await settle(page, 1500);
  const shell = await page.locator("main").innerText();
  const found = GONE.filter((g) => shell.toLowerCase().includes(g.toLowerCase()));
  console.log(`${found.length === 0 ? "ok  " : "MISS"} ${view}: engine offered nowhere${found.length ? ` — found ${JSON.stringify(found)}` : ""}`);
}

// 2. The investor reaches it from a position.
await becomeDemo("investor");
await open("/app/investor/portfolio");
const first = page.locator('a[href*="/app/investor/positions/"]').first();
if (await first.count()) {
  await first.click();
  await settle(page, 3000);
  const why = page.getByRole("link", { name: PT ? /Por que esta oportunidade existiu/i : /Why this opportunity existed/i }).first();
  console.log(`${await why.count() ? "ok  " : "MISS"} a position offers the engine`);
  if (await why.count()) {
    const href = await why.getAttribute("href");
    console.log(`     → ${href}`);
    await why.click();
    await settle(page, 4000);
    const h = await page.locator("main h1, main h2").first().innerText().catch(() => "");
    const picked = await page.locator("body").innerText();
    console.log(`${/Q-[0-9A-F]{6}/.test(picked) ? "ok  " : "MISS"} the engine opens on that request (${h.slice(0, 40)})`);
  }
} else console.log("MISS no position to open");

// 3. She reaches her own route from her loan.
// A fresh context for her: the login page's own chooser signs in as the
// entrepreneur's demo account, which a session already holding another demo
// account will not do.
const her = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
await her.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* private */ } },
  ["empowerfi.app.locale", PT ? "pt" : "en"] as const);
const maria = await her.newPage();
maria.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
maria.on("pageerror", (e) => errors.push(String(e)));
await maria.goto(`${BASE}/app/login`, { waitUntil: "networkidle" });
const g2 = maria.locator('input[type="password"]').first();
if ((await g2.count()) && (await g2.isVisible().catch(() => false))) {
  await g2.fill(DEMO_PASSWORD); await maria.keyboard.press("Enter"); await maria.waitForLoadState("networkidle");
}
await settle(maria, 1200);
await maria.getByRole("radio", { name: PT ? "Empreendedora" : "Entrepreneur", exact: true }).first().click();
await settle(maria, 800);
await maria.getByRole("button", { name: /Enter as demo|Entrar como demo/i }).first().click();
await settle(maria, 5000);
await maria.goto(`${BASE}/app/me/loan`, { waitUntil: "networkidle" });
await settle(maria, 2500);

const route = maria.getByRole("link", { name: PT ? /A rota do seu dinheiro/i : /The route of your money/i }).first();
console.log(`${await route.count() ? "ok  " : "MISS"} her loan offers the route`);
if (!(await route.count())) console.log("LOAN PAGE:", (await maria.locator("main").innerText()).split("\n").filter((l) => l.trim()).slice(0, 12).join(" | "));
if (await route.count()) {
  await route.click();
  await settle(maria, 3000);
  const body = await maria.locator("main").innerText();
  for (const probe of PT
    ? ["A rota do seu dinheiro", "Como chegou até você", "Para onde vai cada parcela", "/USDC"]
    : ["The route of your money", "How it reached you", "Where each instalment goes", "/USDC"])
    console.log(`${body.includes(probe) ? "ok  " : "MISS"} ${probe}`);
  console.log("---\n" + body.split("\n").filter((l) => l.trim()).join("\n"));
  const over = async () => maria.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
      if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth}`);
    }
    return out.slice(0, 6);
  });
  console.log("overflow@1280:", JSON.stringify(await over()));
  for (const w of [768, 390]) {
    await maria.setViewportSize({ width: w, height: 1000 });
    await settle(maria, 800);
    console.log(`overflow@${w}:`, JSON.stringify(await over()));
  }
}

console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
