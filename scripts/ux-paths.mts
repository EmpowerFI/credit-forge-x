// Every path the platform offers, opened as the person it is offered to.
//
// On 19 Sep the login page sent whoever chose the operator view to the page a
// signed-out visitor had been bounced from — so "Enter as demo · Paulo Mendes"
// landed on the investor console, which refuses him. Two of the entrepreneur's
// tools pointed at an anchor that only exists once she is credit-ready. None of
// it showed up in a unit test: these are journeys, and only a browser walks
// them.
//
// Three passes, as each of the five demo personas:
//   entry  bounced to login from another view's page, then choosing this one —
//          the shape of the bug above, which a clean /app/login never shows
//   tools  every destination its view lists in "Your tools", opened directly
//   links  every /app link the persona is actually shown, followed breadth-first
//
// A path fails when it answers "Not available for your role", when it bounces
// somewhere else, or when its #anchor is not on the page it lands on — a link
// that scrolls nowhere is a link that goes nowhere.
//
// VIEWS is imported, not parsed, so this cannot drift from what the UI lists.
//
// Needs the app running against a seeded database:
//   npm run dev
//   UX_BASE=http://localhost:5173 npm run test:ux-paths
import { chromium, type Page } from "@playwright/test";
import { setCurrentLocale, type Locale } from "../src/app/i18n";
import { areaOf, DEMO_PASSWORD } from "../src/app/lib/stories";
import { toolPath, VIEWS, type View } from "../src/app/lib/views";

const BASE = (process.env.UX_BASE ?? "http://localhost:5173").replace(/\/$/, "");
const LOCALE = (process.env.UX_LOCALE === "pt" ? "pt" : "en") as Locale;
const BUDGET = Number(process.env.UX_CRAWL_BUDGET ?? 40);
// The site gate and the demo accounts share one password (stories.ts).
const GATE = process.env.UX_DEMO_PASSWORD ?? DEMO_PASSWORD;

setCurrentLocale(LOCALE);

/** Both languages: a run in one locale should still recognise the other's wall. */
const DENIED = /Not available for your role|Não disponível para o seu perfil/;

interface Finding { view: string; path: string; status: string }
const findings: Finding[] = [];

const settle = (page: Page, ms = 1200) => page.waitForTimeout(ms);

/** Opens `path` and says what is wrong with where it landed, or null. */
async function visit(page: Page, path: string): Promise<string | null> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
  await settle(page);
  const body = await page.locator("body").innerText().catch(() => "");
  if (DENIED.test(body)) return "DENIED";

  const hash = path.includes("#") ? path.split("#")[1] : null;
  if (hash) {
    const there = await page.evaluate(
      (h) => Boolean(document.getElementById(h) || document.getElementsByName(h).length), hash);
    if (!there) return "NO-ANCHOR";
  }
  const landed = page.url().replace(BASE, "");
  const bare = (p: string) => p.split(/[?#]/)[0];
  return bare(landed) === bare(path) ? null : `BOUNCED -> ${landed}`;
}

/**
 * Signs in as the view's demo persona through the login page, as a visitor
 * does. `from` is a protected page to be bounced off first, which leaves
 * ?next= behind — the state in which choosing a different view used to strand
 * the visitor on a page that persona cannot open.
 *
 * A hidden view has no chip, so its door is the Oversight line, named after the
 * area rather than the view. Without this, the run silently entered as whoever
 * the chips defaulted to and reported that persona's refusals as the hidden
 * view's dead ends — nine of them, all saying the same thing twice removed.
 */
async function enterAs(page: Page, view: View, from?: string): Promise<string> {
  await page.goto(`${BASE}${from ?? "/app/login"}`, { waitUntil: "networkidle" });
  const gate = page.locator('input[type="password"]').first();
  if ((await gate.count()) && (await gate.isVisible().catch(() => false))) {
    await gate.fill(GATE);
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
  }
  if (view.hidden) {
    const area = areaOf(view.home.to);
    if (!area) throw new Error(`${view.id}: a hidden view's home belongs to no area, so it has no door`);
    await page.getByRole("button", { name: area.label, exact: true }).first().click();
    await settle(page, 4000);
    return page.url().replace(BASE, "");
  }
  const choice = page.getByRole("radio", { name: view.label, exact: true }).first();
  if (await choice.count()) {
    await choice.click();
    await settle(page, 500);
  }
  // The investor's button offers a wallet first; the others enter straight away.
  await page.getByRole("button", { name: /Enter as demo|Entrar como demo|Explore without a wallet|Explorar sem carteira/i })
    .first().click();
  await settle(page, 4000);
  return page.url().replace(BASE, "");
}

const browser = await chromium.launch();
console.log(`${BASE} · ${LOCALE}\n`);

/** A page belonging to some other view, to be bounced off before entering. */
const elsewhere = (view: View) => VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length].home.to || "/app/investor";

const newContext = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(
    ([key, locale]) => { try { localStorage.setItem(key, locale); } catch { /* private mode */ } },
    ["empowerfi.app.locale", LOCALE] as const);
  return context;
};

for (const view of VIEWS) {
  // entry: bounced off another view's page, then choosing this one.
  {
    const context = await newContext();
    const page = await context.newPage();
    const from = elsewhere(view);
    const landed = await enterAs(page, view, from);
    const body = await page.locator("body").innerText().catch(() => "");
    if (DENIED.test(body)) {
      findings.push({ view: view.id, path: `${from} → enter as ${view.persona.name}`, status: "DENIED" });
      console.log(`${view.id} · entry  DENIED after ${from} → ${landed}`);
    }
    await context.close();
  }

  const context = await newContext();
  const page = await context.newPage();

  const home = await enterAs(page, view);
  console.log(`${view.id} · ${view.persona.name} → ${home}`);
  // A leader's tools live inside the community she runs, which home just found.
  const community = home.match(/\/app\/community\/([0-9a-f-]{36})/)?.[1] ?? null;

  let checked = 0;
  for (const tool of [...view.primary, ...view.secondary]) {
    const path = toolPath(tool, community);
    const bad = await visit(page, path);
    checked++;
    if (bad) {
      findings.push({ view: view.id, path, status: bad });
      console.log(`  tools  ${bad.padEnd(24)} ${path}`);
    }
  }
  console.log(`  tools  ${checked} opened`);

  // Then whatever the persona can actually click, from home outwards.
  const seen = new Set<string>();
  const queue = [home];
  let crawled = 0;
  while (queue.length && crawled < BUDGET) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    crawled++;
    const bad = await visit(page, path);
    if (bad) {
      findings.push({ view: view.id, path, status: bad });
      console.log(`  links  ${bad.padEnd(24)} ${path}`);
    }
    if (bad === "DENIED") continue;
    const hrefs = await page.$$eval('a[href^="/app"]', (as) => as.map((a) => a.getAttribute("href")));
    for (const href of hrefs) {
      if (href && !href.startsWith("/app/login") && !seen.has(href) && !queue.includes(href)) queue.push(href);
    }
  }
  console.log(`  links  ${crawled} followed\n`);
  await context.close();
}

await browser.close();

if (findings.length) {
  console.log("paths that lead nowhere:");
  for (const f of findings) console.log(`  ${f.view.padEnd(13)} ${f.status.padEnd(24)} ${f.path}`);
  console.log(`\n${findings.length} to fix`);
  process.exit(1);
}
console.log("every path opens for the person it is offered to");
