// The corporate site, in both languages and at three widths: one story from
// hero to footer, and nothing on the page that contradicts it.
//   npx tsx scripts/verify-site.mts
import { chromium, type Page } from "@playwright/test";

const BASE = (process.env.UX_BASE ?? "http://localhost:5199").replace(/\/$/, "");
const PT = process.env.UX_LOCALE === "pt";
const settle = (p: Page, ms = 1200) => p.waitForTimeout(ms);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
const page = await context.newPage();
const errors: string[] = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}${PT ? "/pt" : "/"}`, { waitUntil: "networkidle" });
await settle(page, 2000);

const body = (await page.locator("body").innerText()).toLowerCase();

// The thesis, section by section, in the order the argument is made.
const WANTED = PT
  ? ["Infraestrutura de capital · Brasil primeiro", "Capital global. Circulação local.", "Prosperidade mensurável.",
     "A arquitetura", "Inteligência e orquestração de capital",
     "Uma plataforma · quatro motores de capital", "Inteligência de capital", "Alocação de capital", "Orquestração de capital", "Inteligência de impacto",
     "Observar", "Qualificar", "Alocar", "Encaminhar", "Acompanhar", "Medir",
     "O capital existe. A demanda produtiva existe.", "A conexão está quebrada.",
     "Capital local primeiro.", "O capital global é adicional, não substitutivo.",
     "Trilhos econômicos locais", "O que medimos", "não opera moeda local hoje", "não são dados da EmpowerFI",
     "O mundo tem capital.", "A camada que falta",
     "a economias locais investíveis.", "Arquitetura futura",
     "Uma infraestrutura.", "Vários participantes.", "Várias camadas de receita.", "Em validação",
     "Última milha local.", "Trilho global de capital.", "A Solana não é o trilho de pagamento doméstico",
     "Evidência sem", "Nenhum dado pessoal em blockchain",
     "Vamos construir a rede de capital.", "Eu opero uma rede financeira local", "Quero explorar uma integração",
     "Infraestrutura de capital · Brasil primeiro · Global por desenho"]
  : ["Capital infrastructure · Brazil first", "Global capital. Local circulation.", "Measurable prosperity.",
     "The architecture", "Capital intelligence + orchestration",
     "One platform · four capital engines", "Capital intelligence", "Capital allocation", "Capital orchestration", "Impact intelligence",
     "Observe", "Qualify", "Allocate", "Route", "Service", "Measure",
     "Capital exists. Productive demand exists.", "The connection is broken.",
     "Local capital first.", "Global capital is additional, not substitutive.",
     "Local economic rails", "What we measure", "does not operate a local currency today", "not EmpowerFI data",
     "The world has capital.", "The missing layer",
     "to investable local economies.", "Future architecture",
     "One infrastructure.", "Multiple participants.", "Multiple revenue layers.", "In validation",
     "Local last mile.", "Global capital rail.", "Solana is not the domestic payment rail",
     "Evidence without", "No personal data on chain",
     "Let's build the capital network.", "I operate a local financial network", "I want to explore an integration",
     "Capital infrastructure · Brazil first · Global by design"];

// What the old thesis said, and what the brief rules out anywhere on the page.
const GONE = PT
  ? ["negócios investíveis.", "duas inteligências", "Inteligência de comunidade", "Dois motores de receita",
     "Duas rotas para capital", "os três lados do crédito produtivo", "RWA", "Onde você se encaixa"]
  : ["investable businesses.", "two intelligences", "Community intelligence", "Two revenue engines",
     "Two routes to capital", "three sides of productive credit", "RWA", "Where do you fit"];

for (const probe of WANTED) console.log(`${body.includes(probe.toLowerCase()) ? "ok  " : "MISS"} ${probe}`);
for (const probe of GONE) console.log(`${body.includes(probe.toLowerCase()) ? "STILL THERE" : "ok   gone"}: ${probe}`);

const overflow = async () => page.evaluate(() => {
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
    if (el.classList.contains("sr-only") || el.tagName === "SELECT" || el.classList.contains("truncate")
      || el.classList.contains("overflow-x-auto")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.innerText || "").replace(/\n/g, " / ").slice(0, 70)}`);
  }
  return out.slice(0, 8);
});
console.log("---\noverflow@1280:", JSON.stringify(await overflow()));
for (const w of [768, 390]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await settle(page, 900);
  console.log(`overflow@${w}:`, JSON.stringify(await overflow()));
}

// The document scrolls sideways only if something inside it is wider than it.
await page.setViewportSize({ width: 390, height: 1000 });
await settle(page, 700);
const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`${wide <= 1 ? "ok  " : "MISS"} no horizontal page scroll at 390 (${wide}px over)`);

console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
