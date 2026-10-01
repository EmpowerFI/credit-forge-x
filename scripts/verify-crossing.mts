// The crossing: the live route behind the Zcash leg, and the panels that price it.
//   npx tsx scripts/verify-crossing.mts
//   UX_LOCALE=pt npx tsx scripts/verify-crossing.mts
//
// The first half asks NEAR Intents directly, because what this feature claims is
// a fact about their network and not about our code: if Solana ever becomes
// routable into ZEC, or ZEC out of Solana stops being, this run says so and the
// screens need rewriting rather than patching.
import { chromium, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../src/app/lib/stories";
import { intoZec, NoRoute, outOfZec, WAYS_IN, WAYS_OUT } from "../src/app/lib/oneClick";

/** Cloudflare 5xx or a dead socket: the quote service is down, which is not a finding. */
const unreachable = (e: unknown) => /HTTP 5\d\d|fetch failed|ECONN|ETIMEDOUT|socket/i.test(String((e as Error).message));

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const PT = process.env.UX_LOCALE === "pt";
const settle = (p: Page, ms = 1500) => p.waitForTimeout(ms);

// ------------------------------------------------------------ the route itself
for (const w of WAYS_IN) {
  try {
    const c = await intoZec(w.chain, 25_000_000);
    console.log(`ok   in  ${w.name.padEnd(9)} 25 USDC → ${(c.outBase / 1e8).toFixed(8)} ZEC`
      + ` · floor ${(c.minBase / 1e8).toFixed(8)} · costs ${(c.cost * 100).toFixed(2)}% · ~${c.seconds}s`);
  } catch (e) {
    console.log(`${unreachable(e) ? "--  " : "MISS"} in  ${w.name.padEnd(9)} `
      + `${unreachable(e) ? "quote service unreachable" : e instanceof NoRoute ? "no route" : "error"}: ${(e as Error).message}`);
  }
}
// Every way out, not just the preferred one. Which destinations are quotable
// moves within a day: ZEC → Solana priced all one morning and was gone by that
// evening while Base still priced, so the run reports the row rather than a
// verdict about the one chain the product would rather use.
let anyOut = 0;
for (const w of WAYS_OUT) {
  try {
    const c = await outOfZec(2_000_000, w.chain);
    anyOut += 1;
    console.log(`ok   out ${w.name.padEnd(9)} 0.02 ZEC → ${(c.outBase / 1e6).toFixed(6)} USDC`
      + ` · floor ${(c.minBase / 1e6).toFixed(6)} · costs ${(c.cost * 100).toFixed(2)}% · ~${c.seconds}s`);
  } catch (e) {
    console.log(`--   out ${w.name.padEnd(9)} ${unreachable(e) ? "quote service unreachable" : e instanceof NoRoute ? "nobody pricing it now" : "error"}: ${(e as Error).message}`);
  }
}
console.log(`${anyOut > 0 ? "ok  " : "MISS"} ${anyOut} of ${WAYS_OUT.length} ways out are being priced — the panel needs one`);

// ---------------------------------------------------------------- the screens
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "no-preference" });
await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* private */ } },
  ["empowerfi.app.locale", PT ? "pt" : "en"] as const);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle" });
const gate = page.locator('input[type="password"]').first();
if ((await gate.count()) && (await gate.isVisible().catch(() => false))) {
  await gate.fill(DEMO_PASSWORD); await page.keyboard.press("Enter"); await page.waitForLoadState("networkidle");
}
await settle(page, 1000);
await page.getByRole("radio", { name: PT ? "Investidor / Fundo de impacto" : "Investor / Impact Fund", exact: true }).first().click();
await settle(page, 600);
await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
await settle(page, 4500);

await page.goto(`${BASE}/app/investor/opportunities`, { waitUntil: "networkidle" });
await settle(page, 2500);
const href = await page.locator('a[href*="/app/investor/opportunities/"]').first().getAttribute("href");
await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
await settle(page, 2600);

// The shielded tab of the invest card, where a dollar holder meets the route.
await page.getByText(PT ? /ZEC blindado|Shielded ZEC/i : /Shielded ZEC/i).first().click();
await settle(page, 4000);
const inPanel = page.locator("[data-crossing=\"in\"]").first();
if (await inPanel.count()) {
  const box = await inPanel.innerText();
  const floor = PT ? /no mínimo [\d.,]+/ : /at least [\d.,]+/;
  const priced = floor.test(box) && /costs?|custa/.test(box);
  console.log(`${priced ? "ok  " : "MISS"} invest screen prices the way in: ${box.replace(/\n+/g, " | ").slice(0, 170)}`);
  const chains = await page.locator("#crossing-chain option").allInnerTexts();
  console.log(`${chains.length === WAYS_IN.length ? "ok  " : "MISS"} ${chains.length} chains offered: ${chains.join(", ")}`);
  // Switching chain asks again and still prices.
  await page.selectOption("#crossing-chain", "eth");
  await settle(page, 4000);
  const after = await inPanel.innerText();
  console.log(`${floor.test(after) ? "ok  " : "MISS"} still priced after switching chain`);
  console.log(`${/Solana/.test(await page.locator("main").innerText()) ? "ok  " : "MISS"} the page says why Solana is not a way in`);
} else console.log("MISS no way-in panel on the shielded tab");

// A position paid in ZEC, where the way out is priced. Not every seed has one.
await page.goto(`${BASE}/app/investor/portfolio`, { waitUntil: "networkidle" });
await settle(page, 2500);
const positions = await page.locator('a[href*="/app/investor/positions/"]').evaluateAll(
  (els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!))]);
let found = false;
for (const p of positions.slice(0, 6)) {
  await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
  await settle(page, 3000);
  const out = page.locator("[data-crossing=\"out\"]").first();
  if (await out.count()) {
    found = true;
    const box = await out.innerText();
    const floorOut = PT ? /no mínimo [\d.,]+/ : /at least [\d.,]+/;
    console.log(`${floorOut.test(box) ? "ok  " : "MISS"} a ZEC position prices the way out: ${box.replace(/\n+/g, " | ").slice(0, 170)}`);
    break;
  }
}
if (!found) console.log("--   no ZEC-paid position in this seed, so the way out was not rendered");

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")
      || el.classList.contains("overflow-x-auto")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").slice(0, 28).replace(/\n/g, " / ")}`);
  }
  return out.slice(0, 4);
});
await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
await settle(page, 2000);
await page.getByText(PT ? /ZEC blindado|Shielded ZEC/i : /Shielded ZEC/i).first().click();
await settle(page, 3500);
for (const w of [1440, 1280, 1024, 768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await settle(page, 900);
  console.log(`@${w}: overflow ${JSON.stringify(await overflow())}`);
}
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
