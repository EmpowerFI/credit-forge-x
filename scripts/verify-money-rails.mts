// The three money routes, and whether each one arrives leg by leg.
//   npx tsx scripts/verify-money-rails.mts
//   UX_MOTION=reduce npx tsx scripts/verify-money-rails.mts
import { chromium, type Browser, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../src/app/lib/stories";

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const PT = process.env.UX_LOCALE === "pt";
const MOTION = (process.env.UX_MOTION ?? "no-preference") as "reduce" | "no-preference";
const settle = (p: Page, ms = 1200) => p.waitForTimeout(ms);
const errors: string[] = [];

const browser: Browser = await chromium.launch();
async function session(view: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: MOTION });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* private */ } },
    ["empowerfi.app.locale", PT ? "pt" : "en"] as const);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle" });
  const gate = page.locator('input[type="password"]').first();
  if ((await gate.count()) && (await gate.isVisible().catch(() => false))) {
    await gate.fill(DEMO_PASSWORD); await page.keyboard.press("Enter"); await page.waitForLoadState("networkidle");
  }
  await settle(page, 1000);
  await page.getByRole("radio", { name: view, exact: true }).first().click();
  await settle(page, 600);
  await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
  await settle(page, 4500);
  return page;
}

/**
 * Each leg's own box opacity: opacity does not inherit, so a descendant proves
 * nothing. `arm` is for a rail behind a fold, where the fold is the clock: it
 * runs after the reload, because reloading closes what the last probe opened.
 */
async function walk(page: Page, label: string, ol: ReturnType<Page["locator"]>, arm?: () => Promise<void>) {
  if (!(await ol.count())) { console.log(`MISS ${label}: no rail found`); return; }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.reload({ waitUntil: "networkidle" });
  if (arm) { await settle(page, 1500); await arm(); }
  await ol.first().scrollIntoViewIfNeeded();
  const legs = () => ol.first().locator("li > div, li > span:last-child").evaluateAll(
    (els) => els.map((el) => Number(getComputedStyle(el).opacity).toFixed(2)).join(" "));
  const at = await legs();
  await settle(page, 700);
  const mid = await legs();
  await settle(page, 3200);
  const end = await legs();
  const allOn = end.split(" ").every((o) => Number(o) > 0.9);
  const moved = at !== end;
  const ok = MOTION === "reduce" ? allOn && !moved : allOn && moved;
  console.log(`${ok ? "ok  " : "MISS"} ${label}\n       arrives: ${at}\n       part way: ${mid}\n       settled:  ${end}`);
}

// 1. Hers.
{
  const page = await session(PT ? "Empreendedora" : "Entrepreneur");
  await page.goto(`${BASE}/app/me/route`, { waitUntil: "networkidle" });
  await settle(page, 2500);
  const ols = page.locator("main ol");
  console.log(`her route: ${await ols.count()} rails`);
  await walk(page, "her route · how it reached you", ols.nth(0));
  await walk(page, "her route · where each instalment goes", ols.nth(1));
}

// 2. The investor's, on a position, and the engine's route on an opportunity.
{
  const page = await session(PT ? "Investidor / Fundo de impacto" : "Investor / Impact Fund");
  await page.goto(`${BASE}/app/investor/portfolio`, { waitUntil: "networkidle" });
  await settle(page, 2500);
  const href = await page.locator('a[href*="/app/investor/positions/"]').first().getAttribute("href");
  if (href) {
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await settle(page, 2500);
    const ol = page.locator("main ol").filter({ hasText: /Pix/ }).first();
    console.log(`       (${await page.locator("main ol").filter({ hasText: /Pix/ }).count()} candidate rails on the position)`);
    await walk(page, "investor · where the money went", ol);
  } else console.log("MISS no position to open");

  const opp = await page.goto(`${BASE}/app/investor/opportunities`, { waitUntil: "networkidle" }).then(async () => {
    await settle(page, 2500);
    return page.locator('a[href*="/app/investor/opportunities/"]').first().getAttribute("href");
  });
  if (opp) {
    await page.goto(`${BASE}${opp}`, { waitUntil: "networkidle" });
    await settle(page, 2500);
    // This one lives behind a fold now, and the fold is its clock: the run
    // starts when a reader asks how the route was chosen, not when the panel
    // drifts past. So the probe has to ask.
    const ol = page.locator("main ol").filter({ hasText: PT ? /USDC de teste dos investidores/ : /Investors' test USDC/ }).first();
    await walk(page, "opportunity · funding route", ol, async () => {
      await page.locator("main details")
        .filter({ has: page.locator("summary", { hasText: PT ? /Rota de captação/ : /Funding route/ }) })
        .first().locator("summary").first().click();
    });
  } else console.log("MISS no opportunity to open");
}

// Nothing here may be load-bearing: every figure is in the DOM from the first
// paint, so a rail that never animates still reads.
{
  const page = await session(PT ? "Empreendedora" : "Entrepreneur");
  await page.goto(`${BASE}/app/me/route`, { waitUntil: "networkidle" });
  await settle(page, 400);
  const early = (await page.locator("main").innerText()).split(/\s+/).filter(Boolean).length;
  await settle(page, 4000);
  const late = (await page.locator("main").innerText()).split(/\s+/).filter(Boolean).length;
  console.log(`${early === late ? "ok  " : "MISS"} her route reads the same before the rail runs (${early} words) and after (${late})`);
  for (const w of [1280, 768, 390]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await settle(page, 700);
    const over = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
        if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth}`);
      }
      return out.slice(0, 5);
    });
    console.log(`@${w}: overflow ${JSON.stringify(over)}`);
  }
}
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
