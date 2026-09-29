// What each view offers, after the collapse.
//   npx tsx scripts/verify-navigation.mts
//   UX_LOCALE=pt npx tsx scripts/verify-navigation.mts
//
// The start page renders one view's tools at a time, chosen by ?as=, so the
// whole navigation can be read without signing in five times.
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
const choice = page.getByRole("radio", { name: PT ? "Patrocinador de programa / ESG" : "Program Sponsor / ESG", exact: true }).first();
if (await choice.count()) { await choice.click(); await settle(page, 500); }
await page.getByRole("button", { name: /Enter as demo|Entrar como demo/i }).first().click();
await settle(page, 4000);

let total = 0;
for (const view of ["sponsor", "investor", "operator", "community", "entrepreneur"]) {
  await page.goto(`${BASE}/app/start?as=${view}`, { waitUntil: "networkidle" });
  await settle(page, 1500);
  // Each tool is a card with its label and its one line; the label is the first
  // line of each, which is enough to read the shape of a view.
  const tools = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main button, main a"))
      .map((el) => (el as HTMLElement).innerText.split("\n")[0]?.trim())
      .filter((t): t is string => Boolean(t) && t.length < 60));
  const seen = [...new Set(tools)];
  total += seen.length;
  console.log(`\n=== ${view} · ${seen.length}\n${seen.join("\n")}`);
}
console.log(`\n--- ${total} entries across five views`);

// The three that left the menus. Still routed, still linked where they are
// argued about; a menu is what they are gone from.
const everywhere: string[] = [];
for (const view of ["sponsor", "investor", "operator", "community", "entrepreneur"]) {
  await page.goto(`${BASE}/app/start?as=${view}`, { waitUntil: "networkidle" });
  await settle(page, 1200);
  everywhere.push(await page.locator("main").innerText());
}
const all = everywhere.join("\n").toLowerCase();
for (const gone of PT
  ? ["Rede de Capital", "Economia operacional", "Jornada do Capital", "Replay da carteira", "Premissas dos pools", "Custo de servir", "Códigos de motivo"]
  : ["Capital Network", "Operating economics", "Capital Journey", "Portfolio replay", "Pool assumptions", "Cost to serve", "Reason codes"])
  console.log(`${all.includes(gone.toLowerCase()) ? "STILL THERE" : "ok   gone"}: ${gone}`);

console.log(errors.length ? `--- console errors:\n${errors.join("\n")}` : "--- no console errors");
await browser.close();
