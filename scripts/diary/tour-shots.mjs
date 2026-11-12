// The tutorial's pictures: screenshots of the diary itself, with made-up
// figures, in Portuguese and English. Retake them whenever a screen changes.
//
//   npx vite build   (with any VITE_DIARY_SUPABASE_URL; nothing is called)
//   npx vite preview --port 4317 &
//   node scripts/diary/tour-shots.mjs [http://localhost:4317]
//
// Every call to the database and to the functions is answered here, so no
// account and no network are needed. Writes public/app/diario-tour/*.jpg.

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4317";
const OUT = "public/app/diario-tour";
const W = 390;
mkdirSync(OUT, { recursive: true });

const exp = Math.floor(Date.now() / 1000) + 3600;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const user = { id: "u1", email: "maria@exemplo.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const session = { access_token: `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp, role: "authenticated" })}.x`, refresh_token: "r",
  expires_at: exp, expires_in: 3600, token_type: "bearer", user };

const TODAY = "2026-11-04";
const profile = { enrolled: true, today: TODAY, name: "Maria", reminders: { enabled: true, remind_at: "19:00", time_zone: "America/Sao_Paulo" },
  devices: 1, campaign: { name: "Diário EmpowerFI", sponsor_name: "EmpowerFI", is_default: true, until: null }, rewards: [],
  progress_emoji: "money_bag", impact_consent: { share: true, text_version: "web-2026-12d" }, open_days: [1, 2, 3, 4, 5, 6], ai_reading: true };
const entry = (id, kind, amount_cents, payment_method, category = null) =>
  ({ id, kind, amount_cents, payment_method, due_on: null, installments: 1, category, voided: false });
const history = [
  { day: "2026-11-03", no_activity: false, quiet_reason: null, entries: [entry("a", "sale", 18_000, "pix"), entry("b", "expense", 6_500, "cash", "stock")] },
  { day: "2026-11-02", no_activity: false, quiet_reason: null, entries: [entry("c", "sale", 24_000, "card")] },
];
const month = { period: "2026-11", first_day: "2026-11-01", today: TODAY, sales_cents: 312_000, expenses_cents: 118_000, profit_cents: 194_000,
  taken_home_cents: 0, days_kept: 3, monthly_need_cents: 150_000 };
const figures = { sales_cents: 124_000, expenses_cents: 61_000, result_cents: 63_000, pay_cents: null, profit_cents: null };
const readings = (pt) => [{ week_start: "2026-10-26", source: "model", days_kept: 5, open_days: 6, figures, completed_at: "2026-11-02T10:00:00Z", report: pt
  ? { summary: "Na semana, as vendas foram de R$ 1.240,00 e os gastos do negócio, R$ 610,00. Sobraram R$ 630,00.",
      observations: [],
      tip: "A maior parte das vendas entrou no Pix. Muito bem! Nesta semana, antes de comprar ingredientes, veja quais doces mais saíram e compre para eles primeiro.",
      action: "Nesta semana, antes de comprar ingredientes, veja quais doces mais saíram e compre para eles primeiro.",
      limits: "Estes números vêm das suas anotações." }
  : { summary: "This week, sales came to R$ 1,240.00 and business expenses to R$ 610.00. R$ 630.00 was left.",
      observations: [],
      tip: "Most sales came in by Pix. Well done! This week, before buying ingredients, see which sweets sold most and buy for those first.",
      action: "This week, before buying ingredients, see which sweets sold most and buy for those first.",
      limits: "The figures come from your notes." } }];
const pending = [
  { key: "1", kind: "sale", amount_cents: 4_500, payment_method: "pix" },
  { key: "2", kind: "sale", amount_cents: 12_000, payment_method: "credit_card", due_on: "2026-12-04", installments: 3 },
  { key: "3", kind: "expense", amount_cents: 3_800, payment_method: "cash", category: "stock" },
];

// Made-up sponsors with no logo: the tile shows the name.
const sponsors = [
  { name: "Café Aurora", logo_path: null, link_url: "https://example.com", campaigns: ["Mulheres que Empreendem"] },
  { name: "Mercado Bom Dia", logo_path: null, link_url: "https://example.org", campaigns: ["Mulheres que Empreendem"] },
];

const browser = await chromium.launch();

async function open(locale, path, { withPending = false } = {}) {
  const pt = locale.startsWith("pt");
  const ctx = await browser.newContext({ viewport: { width: W, height: 1400 }, deviceScaleFactor: 2, locale });
  await ctx.addInitScript(([s, p, list]) => {
    localStorage.setItem("empowerfi-diary-auth", JSON.stringify(s));
    localStorage.setItem("empowerfi-diary-tour:u1", "seen");
    localStorage.setItem("diary-install-dismissed", "1");
    if (list) localStorage.setItem(`empowerfi-diary-pending:${p}`, JSON.stringify(list));
  }, [session, TODAY, withPending ? pending : null]);
  const answer = { diary_profile: profile, diary_history: history, diary_month: month, diary_readings: readings(pt), diary_campaigns: [], diary_open_campaigns: [], diary_sponsors: sponsors };
  await ctx.route("**/rest/v1/rpc/**", (route) => {
    const fn = route.request().url().split("/rpc/")[1].split("?")[0];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answer[fn] ?? null) });
  });
  await ctx.route("**/functions/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "not_due" }) }));
  await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.mouse.move(0, 0);
  return { page, ctx };
}

// Headless Chromium has no emoji font: phones do. Borrow one for the shot.
const EMOJI_TTF = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/fonts/NotoColorEmoji.ttf";
async function emoji(page) {
  await page.addStyleTag({ content: `@font-face { font-family: "Noto Color Emoji"; src: url(${EMOJI_TTF}) format("truetype"); }` });
  await page.evaluate(async () => {
    for (const el of document.querySelectorAll("body *")) {
      const family = getComputedStyle(el).fontFamily;
      if (!family.includes("Noto Color Emoji")) el.style.fontFamily = `${family}, "Noto Color Emoji"`;
    }
    await document.fonts.load('16px "Noto Color Emoji"', "💰💸");
    await document.fonts.ready;
  });
}

/** A strip of the screen, from the top of one element to the bottom of another. */
async function strip(page, file, top, bottom, pad = 12) {
  await emoji(page);
  const a = await page.locator(top).first().boundingBox();
  const b = await page.locator(bottom).first().boundingBox();
  const y = Math.max(0, a.y - pad);
  await page.screenshot({ path: file, type: "jpeg", quality: 82, clip: { x: 0, y, width: W, height: b.y + b.height + pad - y } });
}

for (const [locale, lang] of [["pt-BR", "pt"], ["en-GB", "en"]]) {
  const f = (name) => `${OUT}/${name}-${lang}.jpg`;

  let { page, ctx } = await open(locale, "/app/diario");
  await strip(page, f("1-today"), "header", "[data-tour=quiet]", 0);
  await strip(page, f("4-month"), "[data-tour=month]", "[data-tour=month]");
  // The tab bar is fixed to the screen: hide it for the shot.
  await page.addStyleTag({ content: "nav[aria-label='EmpowerFI Diário'] { display: none !important; }" });
  await page.locator("section[aria-labelledby^='reading-']").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(200);
  await strip(page, f("5-reading"), "section[aria-labelledby^='reading-']", "section[aria-labelledby^='reading-']");
  await page.locator("[data-tour=add] button").first().click();
  await page.locator("#line-amount").fill("45,00");
  await page.waitForTimeout(200);
  await strip(page, f("2-entry"), "main", "main form button >> nth=-1");
  await ctx.close();

  ({ page, ctx } = await open(locale, "/app/diario", { withPending: true }));
  await page.locator("[data-tour=add] button").first().click();
  await page.waitForTimeout(300);
  await strip(page, f("3-review"), "section[aria-labelledby=review-title]", "section[aria-labelledby=review-title]");
  await ctx.close();

  ({ page, ctx } = await open(locale, "/app/diario/patrocinadores"));
  await strip(page, f("6-sponsors"), "main h1", "main section > p");
  await ctx.close();

  ({ page, ctx } = await open(locale, "/app/diario/lembretes"));
  await strip(page, f("7-reminders"), "main h1", "[data-tour=reminder]");
  await ctx.close();
  console.log(lang, "done");
}
await browser.close();
