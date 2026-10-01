// Where the tools live, now that the landing does not list them.
//   npx tsx scripts/verify-navigation.mts
//   UX_LOCALE=pt npx tsx scripts/verify-navigation.mts
//
// This used to read the "Your tools" grid on the start page: six cards per
// view, each a door to a page whose own dashboard already listed it. The grid
// is gone, so what is worth checking is the claim that replaced it — that every
// dashboard carries its own tools, and that the landing offers a view and a way
// in rather than a second menu.
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

// The landing is a view and a way in, and nothing else. "Your tools" was the
// heading on the grid; the three numbered story cards opened views the chips
// at the top already open.
const body = await page.locator("main").innerText();
const absent = [t("Your tools", "Suas ferramentas"), t("One loop, three stories", "Um ciclo, três histórias")];
for (const gone of absent) console.log(`${body.includes(gone) ? "BACK" : "ok  "} gone from the landing: ${gone}`);

// Admin holds no view of its own, so it keeps every sidebar unfiltered — which
// is what makes one sign-in enough to read them all.
await page.getByRole("button", { name: t("Admin", "Admin"), exact: true }).first().click();
await settle(page, 4000);

/** What each dashboard must carry, in its own sidebar. */
const DASHBOARDS: { area: string; at: string; tools: string[] }[] = [
  { area: "engine", at: "/app/capital", tools: [
    t("Capital Journey", "Jornada do Capital"), t("Engine", "Motor"), t("Capital Network", "Rede de Capital"),
    t("Local Economy", "Economia Local"), t("Operating economics", "Economia operacional")] },
  { area: "investor", at: "/app/investor", tools: [
    t("Overview", "Visão geral"), t("Opportunities", "Oportunidades"), t("Portfolio", "Carteira"),
    t("Positions", "Posições"), t("Settlement", "Liquidação"), t("Proofs", "Provas")] },
  { area: "desk", at: "/app/partner", tools: [
    t("Pipeline", "Pipeline"), t("Opportunities", "Oportunidades"), t("Decisions", "Decisões"),
    t("Portfolio", "Carteira"), t("Servicing", "Acompanhamento de pagamentos")] },
  { area: "business", at: "/app/me", tools: [
    t("My business", "Meu negócio"), t("Monthly check-in", "Check-in mensal"),
    t("My loan", "Meu empréstimo"), t("Consent", "Consentimento")] },
  { area: "audit", at: "/app/audit", tools: [
    t("Attestations", "Atestados"), t("Events", "Eventos"), t("Models", "Modelos"), t("Consents", "Consentimentos"),
    t("Zcash treasury", "Tesouraria Zcash"), t("System", "Sistema"), t("Reports", "Relatórios")] },
];

for (const d of DASHBOARDS) {
  await page.goto(`${BASE}${d.at}`, { waitUntil: "networkidle" });
  await settle(page, 1500);
  const sidebar = page.locator(`nav[aria-label="${t("Views", "Telas")}"]`).first();
  const items = (await sidebar.getByRole("link").allInnerTexts()).map((s) => s.trim());
  console.log(`\n=== ${d.area} · ${d.at}\n${items.join("\n") || "(no sidebar)"}`);
  for (const tool of d.tools) console.log(`${items.includes(tool) ? "ok  " : "MISS"} ${tool}`);
}

// The sponsor's dashboard is one page rather than a sidebar, so its sections
// are where its tools went. They are anchors, and an anchor that does not exist
// is a menu entry that scrolls nowhere.
await page.goto(`${BASE}/app/impact`, { waitUntil: "networkidle" });
await settle(page, 3500);
console.log("\n=== sponsor · /app/impact (one page, its own sections)");
for (const id of ["funnel", "capital", "outcomes", "evidence", "report"]) {
  const there = await page.locator(`#${id}`).count();
  console.log(`${there ? "ok  " : "MISS"} #${id}`);
}

console.log(errors.length ? `\n--- console errors\n${errors.join("\n")}` : "\n--- no console errors");
await browser.close();
