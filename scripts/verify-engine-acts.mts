// The engine page in three acts: qualify, allocate, then follow the capital.
//   npx tsx scripts/verify-engine-acts.mts
//   UX_LOCALE=pt npx tsx scripts/verify-engine-acts.mts
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
const choice = page.getByRole("radio", { name: PT ? "Operador de crédito / capital" : "Credit / Capital Operator", exact: true }).first();
if (await choice.count()) { await choice.click(); await settle(page, 500); }
await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i }).first().click();
await settle(page, 4000);

await page.goto(`${BASE}/app/capital/engine`, { waitUntil: "networkidle" });
await settle(page, 2500);

// Case-insensitive: `eyebrow` and the band labels uppercase in CSS, so
// innerText returns them shouting and an exact probe would always MISS.
const has = async (probe: string) =>
  (await page.locator("body").innerText()).toLowerCase().includes(probe.toLowerCase());
const check = async (probe: string) => console.log(`${(await has(probe)) ? "ok  " : "MISS"} ${probe}`);

// ---- the picker must offer a request whose capital went somewhere
await page.getByRole("combobox").first().click();
await settle(page, 700);
const settledHeading = t("Already lent", "Já emprestadas");
const group = page.locator("[cmdk-group]").filter({ hasText: new RegExp(settledHeading, "i") });
console.log(`${(await group.count()) ? "ok  " : "MISS"} picker group: ${settledHeading}`);
const option = (await group.count()) ? group.getByRole("option").first() : page.getByRole("option").last();
const picked = (await option.innerText()).split("\n")[0];
await option.click();
await settle(page, 900);
console.log(`--- following ${picked}`);

// ---- act 1
await page.getByRole("button", { name: new RegExp(t("RUN CREDIT ENGINE", "RODAR O MOTOR DE CRÉDITO"), "i") }).first().click();
await settle(page, 3500);
await check(t("Qualified credit opportunity", "Oportunidade de crédito qualificada"));

// ---- act 2
await page.getByRole("button", { name: new RegExp(t("RUN CAPITAL ALLOCATION", "RODAR A ALOCAÇÃO DE CAPITAL"), "i") }).first().click();
await settle(page, 6000);
await check(t("Capital Allocation Engine", "Motor de Alocação de Capital"));

// ---- the seam, which is the page's argument
for (const probe of PT
  ? ["SEGUIR O CAPITAL", "a tela de um fundo convencional também para aqui"]
  : ["FOLLOW THE CAPITAL", "a conventional fund's screen stops here too"]) await check(probe);

// ---- act 3
await page.getByRole("button", { name: new RegExp(t("FOLLOW THE CAPITAL", "SEGUIR O CAPITAL"), "i") }).first().click();
await settle(page, 4000);

for (const probe of PT
  ? ["O registro · não é simulação", "O que o capital fez",
     "Fora do Brasil", "em dólar", "a travessia", "Dentro do território", "em reais",
     "Investidores põem o dinheiro", "A cota vira um ativo", "Dólares viram reais",
     "A mesa paga a ela", "E depois", "Ele volta como stablecoin",
     "De volta para o investidor", "liberam exatamente os reais",
     "O laço, de ponta a ponta"]
  : ["The record · not a re-run", "What the capital did",
     "Outside Brazil", "in dollars", "the crossing", "Inside the territory", "in reais",
     "Investors put up the money", "The share becomes an asset", "Dollars become reais",
     "The desk pays her", "And then what", "It comes back as stablecoin",
     "Back out to the investor", "release exactly the reais",
     "The loop, end to end"]) await check(probe);

// The act as it reads, so a figure that is wrong is visible and not just present.
const body = await page.locator("body").innerText();
const from = body.indexOf(t("What the capital did", "O que o capital fez"));
console.log("---\n" + body.slice(from < 0 ? 0 : from).split("\n").filter((l) => l.trim()).join("\n"));

// ---- overflow, at the three widths the rest of the app is checked at
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
