// The borrower's own loan, and paying an instalment.
//   npx tsx scripts/verify-my-loan.mts
//   UX_LOCALE=pt npx tsx scripts/verify-my-loan.mts
//
// It pays a real instalment against whatever database it points at, so run it
// on the local one and reseed after.
import { chromium, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../src/app/lib/stories";

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const PT = process.env.UX_LOCALE === "pt";
const settle = (p: Page, ms = 1200) => p.waitForTimeout(ms);
const t = (en: string, pt: string) => (PT ? pt : en);

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
const choice = page.getByRole("radio", { name: t("Entrepreneur", "Empreendedora"), exact: true }).first();
if (await choice.count()) { await choice.click(); await settle(page, 500); }
await page.getByRole("button", { name: /Enter as demo|Entrar como demo/i }).first().click();
await settle(page, 4000);

await page.goto(`${BASE}/app/me/loan`, { waitUntil: "networkidle" });
await settle(page, 2500);

const has = async (probe: string) =>
  (await page.locator("body").innerText()).toLowerCase().includes(probe.toLowerCase());
const check = async (probe: string) => console.log(`${(await has(probe)) ? "ok  " : "MISS"} ${probe}`);

// Which instalment is next is read rather than assumed: this script pays one
// every time it runs, so a hard-coded number is wrong on the second run.
const nextNo = (await page.locator("body").innerText())
  .match(PT ? /Parcela (\d+) de (\d+)/ : /Instalment (\d+) of (\d+)/);
console.log(`--- next up: ${nextNo ? nextNo[0] : "not found"}`);

for (const probe of PT
  ? ["Meu empréstimo", "O que você pegou", "Emprestado", "Pago até agora", "Falta pagar", "GRJ", "Você tem", "Pagar esta parcela", "Pagas"]
  : ["My loan", "What you borrowed", "Borrowed", "Paid so far", "Left to pay", "GRJ", "You hold", "Pay this instalment", "Paid"])
  await check(probe);

console.log("--- before paying\n" + (await page.locator("body").innerText())
  .split("\n").slice((await page.locator("body").innerText()).split("\n")
    .findIndex((l) => l.includes(t("My loan", "Meu empréstimo")))).filter((l) => l.trim()).join("\n"));

// ---- she pays
await page.getByRole("button", { name: new RegExp(t("Pay this instalment", "Pagar esta parcela"), "i") }).first().click();
await settle(page, 3000);

const paidLine = nextNo
  ? (PT ? `Parcela ${nextNo[1]} de ${nextNo[2]} paga` : `Instalment ${nextNo[1]} of ${nextNo[2]} paid`)
  : t("paid", "paga");
for (const probe of PT
  ? [paidLine, "de volta à tesouraria", "liberados", "USDC", "a caminho de quem financiou você"]
  : [paidLine, "back to the", "treasury", "released", "USDC", "on its way to whoever funded you"])
  await check(probe);

const after = await page.locator("body").innerText();
const from = after.indexOf(paidLine);
console.log("--- after paying\n" + after.slice(from < 0 ? 0 : from).split("\n").filter((l) => l.trim()).join("\n"));

for (const width of [1280, 768, 390]) {
  await page.setViewportSize({ width, height: 1100 });
  await settle(page, 900);
  const over = await page.evaluate(() => Array.from(document.querySelectorAll("*"))
    .filter((el) => {
      const e = el as HTMLElement;
      if (e.closest(".sr-only, .truncate, .overflow-x-auto") || e.tagName === "SELECT") return false;
      return e.scrollWidth > e.clientWidth + 1;
    })
    .slice(0, 6)
    .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} ${el.scrollWidth}>${el.clientWidth}`));
  const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`--- ${width}px  overflow: ${over.length ? over.join(" | ") : "none"}  page scroll: ${doc > 0 ? `${doc}px` : "none"}`);
}

console.log(errors.length ? `--- console errors:\n${errors.join("\n")}` : "--- no console errors");
await browser.close();
