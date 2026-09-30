// One opportunity, as an investor meets it: what is above the fold, whether the
// invest action is usable, and the funding route filling in.
//   npx tsx scripts/verify-opportunity.mts
import { chromium, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../src/app/lib/stories";

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const PT = process.env.UX_LOCALE === "pt";
const settle = (p: Page, ms = 1500) => p.waitForTimeout(ms);
const browser = await chromium.launch();
// Playwright leaves prefers-reduced-motion to the browser, and headless
// Chromium answers "reduce". The animation is for readers who did not ask for
// that, so the run says which state it is measuring.
const MOTION = (process.env.UX_MOTION ?? "no-preference") as "reduce" | "no-preference";
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: MOTION });
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
// Every raising opportunity, including the one left a few dollars short.
const links = await page.locator('a[href*="/app/investor/opportunities/"]').evaluateAll(
  (els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!))]);
console.log(`${links.length} opportunities listed · prefers-reduced-motion: ${MOTION}`);

for (const href of links.slice(0, 4)) {
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await settle(page, 2600);
  const code = (await page.locator("main").innerText()).match(/Q-[0-9A-F]{6}/)?.[0] ?? "?";
  const field = page.locator('input[inputmode="decimal"], input[type="number"], input#amount').first();
  const amount = (await field.count()) ? await field.inputValue() : "(no field)";
  const caution = await page.locator("main .text-caution").allInnerTexts();
  const act = page.getByRole("button", { name: PT ? /Conectar minha carteira|Investir/i : /Connect your wallet|^Invest/i }).first();
  const label = (await act.count()) ? (await act.innerText()).replace(/\n/g, " ") : "(no action)";
  const usable = (await act.count()) ? await act.isEnabled() : false;
  // How far down the page the money lives.
  const box = (await act.count()) ? await act.boundingBox() : null;
  console.log(`${usable ? "ok  " : "MISS"} ${code} · amount "${amount}" · "${label}" ${usable ? "enabled" : "DISABLED"}`
    + ` · action at y=${box ? Math.round(box.y) : "?"}`
    + (caution.length ? ` · caution ${JSON.stringify(caution.slice(0, 2))}` : ""));
}

// The route animates: count the visible legs just after load, then after it runs.
// The panel's own list, identified by its first leg rather than by a container:
// the lifecycle also names a Pix to her business.
const firstLeg = PT ? /USDC de teste dos investidores/ : /Investors' test USDC/;
const route = page.locator("main ol").filter({ hasText: firstLeg }).first();
if (await route.count()) {
  await page.reload({ waitUntil: "networkidle" });
  await route.scrollIntoViewIfNeeded();
  // Each leg's own box, not a descendant: opacity does not inherit, so a child
  // of an invisible box still computes to 1 and a probe on one proves nothing.
  const legs = () => route.locator("li > span:last-child").evaluateAll(
    (els) => els.map((el) => Number(getComputedStyle(el).opacity).toFixed(2)).join(" "));
  console.log(`route, as it comes into view: ${await legs()}`);
  await settle(page, 900);
  console.log(`route, part way:             ${await legs()}`);
  await settle(page, 2600);
  const done = await legs();
  console.log(`route, settled:              ${done}`);
  console.log(`${done.split(" ").every((o) => Number(o) > 0.9) ? "ok  " : "MISS"} every leg ends visible`);
} else console.log("MISS no funding route on this opportunity");

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")
      || el.classList.contains("overflow-x-auto")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth}`);
  }
  return out.slice(0, 6);
});
for (const w of [1440, 1280, 1024, 768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 900);
  const panel = page.locator("main").getByText(PT ? /^Investir$/ : /^Invest$/).first();
  const pbox = (await panel.count()) ? await panel.boundingBox() : null;
  const act = page.getByRole("button", { name: PT ? /Conectar minha carteira|Investir/i : /Connect your wallet|^Invest/i }).first();
  const box = (await act.count()) ? await act.boundingBox() : null;
  console.log(`@${w}: Invest panel y=${pbox ? Math.round(pbox.y) : "?"} · button y=${box ? Math.round(box.y) : "?"} · overflow ${JSON.stringify(await overflow())}`);
}
// How much there is to read, and how much of it is asked for rather than shown.
await page.setViewportSize({ width: 1280, height: 1000 });
await settle(page, 800);
const weight = await page.evaluate(() => {
  const main = document.querySelector("main") as HTMLElement;
  const shown = main.innerText.split(/\s+/).filter(Boolean).length;
  let hidden = 0;
  for (const d of Array.from(main.querySelectorAll("details:not([open])"))) {
    hidden += (d as HTMLElement).innerText.split(/\s+/).filter(Boolean).length;
  }
  return { shown, hidden, panels: main.querySelectorAll("section, .panel").length,
           disclosures: main.querySelectorAll("details").length };
});
console.log(`page: ${weight.shown} words shown across ${weight.panels} panels · ${weight.disclosures} disclosures, ${weight.hidden} words folded away`);
// Every fold opens from the keyboard alone: a native summary takes focus and
// Enter, and a panel that can only be opened with a mouse is a panel some
// readers cannot open at all.
await page.setViewportSize({ width: 1280, height: 1000 });
await page.evaluate(() => window.scrollTo(0, 0));
await settle(page, 500);
const folds = await page.locator("main details").count();
let opened = 0;
for (let i = 0; i < folds; i += 1) {
  const d = page.locator("main details").nth(i);
  await d.locator("summary").focus();
  await page.keyboard.press("Enter");
  await settle(page, 250);
  if (await d.evaluate((el) => (el as HTMLDetailsElement).open)) opened += 1;
}
console.log(`${opened === folds ? "ok  " : "MISS"} ${opened}/${folds} folds open from the keyboard`);
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
