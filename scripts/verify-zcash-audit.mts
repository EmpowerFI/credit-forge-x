// The Zcash audit screens: that a reader is handed the checks rather than a number.
//   npx tsx scripts/verify-zcash-audit.mts
//
// What this guards. The notes table is decrypted with the treasury's viewing key
// and served from our own database, which reads as a claim unless the screen
// shows how to check it. So: no explorer link on testnet (every one of our ids
// answers not-found, and a link that cannot succeed is worse than none), the
// reason stated above the table rather than in a hover title, a route into the
// per-transaction page, and on that page both checks with the output each one
// should produce.
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
const choice = page.getByRole("radio", { name: PT ? "Operação" : "Operations", exact: true }).first();
if (await choice.count()) { await choice.click(); await settle(page, 500); }
await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
await settle(page, 4000);

const fails: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };

await page.goto(`${BASE}/app/audit/zcash`, { waitUntil: "networkidle" });
await settle(page, 2500);

// The demo's Operations role is not the auditor: the audit screens offer to
// switch into the persona that holds the role, and that offer is the way in.
const asAuditor = page.getByRole("button", { name: /Enter as the demo|Entrar como a demo|Entrar como o demo/i }).first();
if (await asAuditor.count()) {
  await asAuditor.click();
  await page.waitForLoadState("networkidle");
  await settle(page, 3000);
  if (!/\/audit\/zcash/.test(page.url())) {
    await page.goto(`${BASE}/app/audit/zcash`, { waitUntil: "networkidle" });
    await settle(page, 2500);
  }
}

const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
const configured = !/No treasury yet|Ainda sem tesouraria/i.test(body);
console.log(`treasury configured in this environment: ${configured}`);

if (!configured) {
  // Nothing to assert about rows that do not exist. Said rather than passed over,
  // because a green run against an empty treasury would mean nothing.
  console.log("--- the rest needs a treasury with received notes; run against an environment that has one");
} else {
  check(/Ironwood/i.test(body), "the note above the table names the Ironwood pool");
  check(/NU6\.3/i.test(body), "and the upgrade that added it");
  check(!/\bexplorer\b|\bexplorador\b/i.test(
    await page.locator("table").innerText().catch(() => "")) ||
    /not on any explorer|fora dos exploradores/i.test(body),
    "no live explorer link inside the table on testnet");
  check(/Shared USDC credit|Crédito compartilhado em USDC/i.test(body),
    "the credit column is named as a shared transfer");

  const intoPage = page.getByRole("link", { name: /How to check this|Como verificar isto/i }).first();
  check((await intoPage.count()) > 0, "every transaction links to its verification page");

  if (await intoPage.count()) {
    await intoPage.click();
    await page.waitForLoadState("networkidle");
    await settle(page, 2000);
    const vp = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    check(/Check 1|Checagem 1/i.test(vp), "check 1 is on the verification page");
    check(/Check 2|Checagem 2/i.test(vp), "check 2 is on the verification page");
    check(/zec\.rocks/i.test(vp), "the command names the public server it asks");
    check(/What it should print|O que deve imprimir/i.test(vp), "check 1 says what it should return");
    check(/list-tx should print|list-tx deve imprimir/i.test(vp), "check 2 predicts the wallet's output");
    check(/enhance/i.test(vp), "the enhance step is in the commands");
    check(/Memo::Text/i.test(vp), "the predicted output carries the memo as the wallet prints it");
    check(/Why there is no explorer|Por que não há link de explorador/i.test(vp),
      "the page explains the missing explorer rather than leaving a gap");
    check((await page.getByRole("button", { name: /Reveal|Revelar/i }).count()) > 0,
      "the viewing key is offered, behind a reveal");
  }
}

const overflow = () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")) continue;
    if (el.tagName === "PRE" || el.tagName === "CODE" || el.closest("pre")) continue; // scroll on purpose
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 70)}`);
    }
  }
  return out.slice(0, 10);
});
console.log("---\noverflow@1280:", JSON.stringify(await overflow()));
await page.screenshot({ path: "/tmp/shots/zcash-verify.png", fullPage: true });
for (const w of [768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await settle(page, 900);
  console.log(`overflow@${w}:`, JSON.stringify(await overflow()));
}
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} check(s) failed`);
  process.exitCode = 1;
}
