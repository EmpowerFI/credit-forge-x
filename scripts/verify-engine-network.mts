// A2/A3 on screen: the engine page's result, the network plan under it, and the
// second question's three readings on the network page.
//
//   npx tsx scripts/verify-engine-network.mts
import { chromium, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../src/app/lib/stories";

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const OUT = process.env.OUT ?? "/tmp/shots";
const settle = (p: Page, ms = 1200) => p.waitForTimeout(ms);

async function enter(page: Page, label: string) {
  await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle" });
  const gate = page.locator('input[type="password"]').first();
  if ((await gate.count()) && (await gate.isVisible().catch(() => false))) {
    await gate.fill(DEMO_PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
  }
  const choice = page.getByRole("radio", { name: label, exact: true }).first();
  if (await choice.count()) { await choice.click(); await settle(page, 500); }
  await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
  await settle(page, 4000);
}

/** Anything wider than its box, which is what a long sentence in a tile does. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 90)}`);
      }
    }
    return out.slice(0, 12);
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
await context.addInitScript(
  ([k, v]) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  ["empowerfi.app.locale", process.env.UX_LOCALE === "pt" ? "pt" : "en"] as const);
const page = await context.newPage();
const errors: string[] = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await enter(page, process.env.UX_LOCALE === "pt" ? "Operador de crédito / capital" : "Credit / Capital Operator");
console.log("landed:", page.url().replace(BASE, ""));

// ---- the engine page, one request at a time
const CODES = (process.env.CODES ?? "Q-E3BC74,Q-7B6D7D,Q-6BCEC4").split(",");
for (const code of CODES) {
  console.log(`\n=== ${code}`);
  await page.goto(`${BASE}/app/capital?opportunity=${code}`, { waitUntil: "networkidle" });
  await settle(page, 2000);
  const run = page.getByRole("button", { name: /RUN CREDIT ENGINE|RODAR O MOTOR DE CRÉDITO/i }).first();
  if (!(await run.count())) { console.log("  no run button — not in the picker"); continue; }
  if (await run.isDisabled()) { console.log("  run disabled — code not selected"); continue; }
  await run.click();
  await settle(page, 1500);
  for (let i = 0; i < 2; i++) {
    const skip = page.getByRole("button", { name: /Skip animation|Pular animação/i }).first();
    if (await skip.count()) { await skip.click(); await settle(page, 900); }
    const alloc = page.getByRole("button", { name: /RUN CAPITAL ALLOCATION|RODAR A ALOCAÇÃO DE CAPITAL/i }).first();
    if (await alloc.count()) { await alloc.click(); await settle(page, 1200); }
  }
  await settle(page, 3500);

  const body = await page.locator("body").innerText();
  const PT = process.env.UX_LOCALE === "pt";
  for (const probe of PT ? [
    "O resto da rede, sobre este mesmo pedido",
    "Plano de capital recomendado",
    "Capital de fora do Brasil",
    "O que o mês dela alcança disso",
    "Encaminhado para fora neste plano",
  ] : [
    "The rest of the network, on this same request",
    "Recommended capital plan",
    "Capital from outside Brazil",
    "What her month reaches of it",
    "Routed abroad in this plan",
  ]) console.log(`  ${body.includes(probe) ? "ok  " : "MISS"} ${probe}`);
  for (const re of [
    /(Domestic P2P selected|Global P2P selected|Waiting for capital|Not qualified)/,
    /(ROUTE SELECTED|WAITING FOR CAPITAL)[\s\S]{0,120}/,
    /A rede foi perguntada sobre o pool [^\n]*/,
    /Nenhum pool assumiu este pedido ainda[^\n]*/,
    /As premissas mudaram[^\n]*/,
    /restam [^\n]*no pool[^\n]*/,
    /(No local rail here, so reais|Sem trilho local aqui)[^\n]*/,
    /(Local capital did not cover it|O capital local n\u00e3o cobriu)[^\n]*/,
    /(Capital from abroad added to it|O capital de fora somou)[^\n]*/,
    /abaixo do ticket mínimo[^\n]*/,
    /da lacuna, ao preço cotado[^\n]*/,
    /toda a lacuna[^\n]*/,
    /The network was asked about the [^\n]*/,
    /No pool has taken this request yet[^\n]*/,
    /Assumptions have moved[^\n]*/,
    /Gap asked about\n[^\n]*\n[^\n]*/,
    /What her month reaches of it\n[^\n]*\n[^\n]*/,
    /Routed abroad in this plan\n[^\n]*\n[^\n]*/,
    /left in the pool[^\n]*/,
    /under the [^\n]*smallest ticket[^\n]*/,
    /refused on another question[^\n]*/,
    /% of the gap[^\n]*/,
    /all of the gap[^\n]*/,
  ]) { const m = body.match(re); if (m) console.log("  ·", m[0].replace(/\n/g, " / ")); }
  console.log("  overflow:", JSON.stringify(await overflow(page)));
  await page.screenshot({ path: `${OUT}/engine-${code}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await settle(page, 900);
  console.log("  overflow@390:", JSON.stringify(await overflow(page)));
  await page.setViewportSize({ width: 1280, height: 1100 });
}

console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
