// The demo scenario: four verified communities, 100 participants, education
// progress, six months of check-ins, a readiness assessment for everyone and
// credit intents for some of those who are ready — with every community,
// verification, enrollment, month and assessment queued for the chain, so the
// anchoring pipeline writes real devnet proofs for all of it (plan D9: seeded
// breadth, real anchors).
//
//   PLATFORM_SERVICE_KEY_FILE=<file with the service role key> \
//     npx tsx scripts/platform/seed-demo.mts --yes
//
// Deterministic: the same names, businesses, dates and progress every run,
// from a fixed-seed generator. Chain refs and borrower refs are random, as
// they must be. Starts with reset_demo_data(), which wipes communities,
// members, education and anchors — hence --yes. Accounts and partners stay;
// run seed-demo-accounts.mts first.
//
// A first cycle of loans, from July, is recorded through the same functions
// and then dated to when it happened; the seed holds the anchor worker until
// it is done, so the proofs carry those dates.
//
// Everything is marked is_simulated.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { assessReadiness, type CheckinRecord } from "../../packages/readiness-engine/src/index.ts";
import { assessEligibility, type EligibilityInput } from "../../packages/eligibility-engine/src/index.ts";

if (!process.argv.includes("--yes")) {
  console.error("This wipes the demo scenario on the hackathon project. Re-run with --yes.");
  process.exit(1);
}

const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
// The demo accounts' shared password, public on purpose (see seed-demo-accounts.mts).
const DEMO_PASSWORD = "EmpowerFI-demo-2026";
const keyFile = process.env.PLATFORM_SERVICE_KEY_FILE;
if (!keyFile) throw new Error("set PLATFORM_SERVICE_KEY_FILE");
const db = createClient(URL, readFileSync(keyFile, "utf8").trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// ------------------------------------------------------------ determinism

// mulberry32: small, fast, and the same sequence on every machine.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(20260914);
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const between = (from: Date, to: Date) => new Date(from.getTime() + random() * (to.getTime() - from.getTime()));
const iso = (d: Date) => d.toISOString();

const FIRST = [
  "Ana", "Beatriz", "Camila", "Cláudia", "Daniela", "Débora", "Edna", "Elaine", "Fabiana", "Fernanda",
  "Gabriela", "Gisele", "Helena", "Irene", "Ivone", "Jaqueline", "Joana", "Josefa", "Juliana", "Kátia",
  "Larissa", "Lúcia", "Luana", "Márcia", "Mariana", "Marta", "Natália", "Neide", "Patrícia", "Priscila",
  "Raquel", "Regina", "Rita", "Rosa", "Sandra", "Sílvia", "Simone", "Sônia", "Tatiane", "Tereza",
  "Valéria", "Vanessa", "Vera", "Viviane", "Adriana", "Aline", "Bruna", "Carla", "Denise", "Eliane",
] as const;
const LAST = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
  "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
  "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas",
] as const;
const BUSINESS: Record<string, readonly ((first: string, last: string) => string)[]> = {
  food: [(f) => `Doces da ${f}`, (_, l) => `Marmitas ${l}`, (f) => `Salgados da ${f}`, (f) => `Bolos da ${f}`],
  beauty: [(f) => `Studio ${f}`, (f) => `Salão da ${f}`, (_, l) => `Espaço ${l} Beleza`],
  crafts: [(f) => `Ateliê ${f}`, (_, l) => `Artesanato ${l}`, (f) => `Crochê da ${f}`],
  fashion: [(f) => `Costura da ${f}`, (_, l) => `Moda ${l}`, (f) => `Brechó da ${f}`],
  retail: [(_, l) => `Mercearia ${l}`, (f) => `Bazar da ${f}`, (f) => `Cosméticos da ${f}`],
  services: [(f) => `Faxina da ${f}`, (f) => `Cuidados ${f}`, (_, l) => `Lavanderia ${l}`],
};
const SECTORS = Object.keys(BUSINESS);

// ------------------------------------------------------------------ people

const profiles = await must("profiles", db.from("profiles").select("id, role, display_name"));
const admin = profiles.find((p) => p.role === "admin");
const lucia = profiles.find((p) => p.display_name === "Lúcia Santos");
if (!admin || !lucia) throw new Error("run seed-demo-accounts.mts first");

// Leaders of the other three communities. They exist so each community has
// one, and cannot log in: their password is random and never stored.
const SEED_LEADERS = [
  { email: "cida.leader@seed.empowerfi.io", name: "Cida Ferreira" },
  { email: "rose.leader@seed.empowerfi.io", name: "Rose Almeida" },
  { email: "dora.leader@seed.empowerfi.io", name: "Dora Nascimento" },
];
const { data: authList, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const leaderIds: string[] = [];
for (const l of SEED_LEADERS) {
  let user = authList.users.find((u) => u.email === l.email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: l.email,
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { display_name: l.name },
    });
    if (error) throw new Error(`create ${l.email}: ${error.message}`);
    user = data.user;
  }
  await must(`role ${l.email}`, db.from("profiles").update({ role: "community_leader", display_name: l.name }).eq("id", user.id));
  leaderIds.push(user.id);
}

// Investors who fund alongside the demo investor. Like the leaders above, they
// exist to hold positions and cannot log in.
const SEED_INVESTORS = [
  { email: "fundo.semente@seed.empowerfi.io", name: "Fundo Semente (seed)" },
  { email: "rede.anjos@seed.empowerfi.io", name: "Rede de Anjos (seed)" },
  { email: "diaspora.capital@seed.empowerfi.io", name: "Diáspora Capital (seed)" },
];
const seedInvestorIds: string[] = [];
for (const v of SEED_INVESTORS) {
  let user = authList.users.find((u) => u.email === v.email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: v.email,
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { display_name: v.name },
    });
    if (error) throw new Error(`create ${v.email}: ${error.message}`);
    user = data.user;
  }
  await must(`role ${v.email}`, db.from("profiles").update({ role: "capital_provider", display_name: v.name }).eq("id", user.id));
  seedInvestorIds.push(user.id);
}
const irene = profiles.find((p) => p.display_name === "Irene Costa");
if (!irene) throw new Error("run seed-demo-accounts.mts first: no demo investor");

// Investors fund an opportunity up to `fill` of its USDC target, the demo
// investor taking `ireneShare` of the whole. Simulated positions: no deposit
// on chain, and marked so — their allocations are proven all the same.
const fundRandom = rng(20260915);
async function fund(opportunityId: string, fill: number, ireneShare: number, at: string) {
  const { data: o, error } = await db.from("qualified_credit_opportunities")
    .select("funding_target_micro_usdc").eq("id", opportunityId).single();
  if (error) throw error;
  const target = Math.round(o.funding_target_micro_usdc / 1_000_000);
  const goal = fill >= 1 ? target : Math.floor(target * fill);
  const parts: [string, number][] = [];
  const mine = Math.min(goal, Math.floor(target * ireneShare));
  if (mine > 0) parts.push([irene!.id, mine]);
  let rest = goal - mine;
  for (const [k, id] of seedInvestorIds.entries()) {
    const take = k === seedInvestorIds.length - 1 ? rest : Math.floor(rest * (0.4 + fundRandom() * 0.3));
    if (take > 0) parts.push([id, take]);
    rest -= take;
  }
  for (const [investorId, usdc] of parts) {
    await must("fund", db.rpc("record_investment", {
      p_investor_id: investorId, p_opportunity_id: opportunityId, p_amount_micro_usdc: usdc * 1_000_000,
      p_mode: "simulated", p_is_simulated: true, p_created_at: at,
    }));
  }
}

// -------------------------------------------------------------- the worker
// Held for the whole run: the first cycle's facts are dated after the
// functions record them, and must not reach the chain before that.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
for (let i = 0; ; i++) {
  const { data: held, error } = await db.rpc("start_anchor_run", { p_lease_seconds: 1200 });
  if (error) throw new Error(`anchor worker: ${error.message}`);
  if (held) break;
  if (i === 60) throw new Error("the anchor worker stayed busy for two minutes");
  await sleep(2000);
}

// ------------------------------------------------------------------- reset

const wiped = await must(
  "reset",
  db.rpc("reset_demo_data", { p_confirm: "reset empowerfi-hackathon demo data" }),
);
console.log("reset:", wiped);

// ------------------------------------------------------------- communities

const COMMUNITIES = [
  { name: "Mulheres Empreendedoras do Grajaú", kind: "education_programme", city: "São Paulo", state: "SP",
    leader: lucia.id, members: 40, created: "2026-06-02T13:00:00Z",
    description: "Twelve-week preparation cohort run with a neighbourhood association in the south of São Paulo." },
  { name: "Cooperativa Mãos que Criam", kind: "cooperative", city: "Recife", state: "PE",
    leader: leaderIds[0], members: 25, created: "2026-06-09T14:30:00Z",
    description: "Craft and textile cooperative selling at fairs and online." },
  { name: "Rede Feira Viva", kind: "association", city: "Belo Horizonte", state: "MG",
    leader: leaderIds[1], members: 20, created: "2026-06-16T12:00:00Z",
    description: "Association of street-market vendors, mostly food and produce." },
  { name: "Coletivo Sabores da Periferia", kind: "collective", city: "Salvador", state: "BA",
    leader: leaderIds[2], members: 15, created: "2026-06-23T15:00:00Z",
    description: "Home-kitchen food entrepreneurs who share purchasing and delivery." },
] as const;

const communityRows = COMMUNITIES.map((c) => {
  const created = new Date(c.created);
  const verified = new Date(created.getTime() + (3 + Math.floor(random() * 5)) * 86_400_000);
  return {
    name: c.name, kind: c.kind, city: c.city, state: c.state, description: c.description,
    leader_id: c.leader, status: "verified", created_at: iso(created),
    verified_at: iso(verified), verified_by: admin.id, review_note: "Site visit and leader interview",
    is_simulated: true,
  };
});
const communities = await must(
  "communities",
  db.from("communities").insert(communityRows).select("id, name, verified_at, leader_id"),
);
const byName = new Map(communities.map((c) => [c.name, c]));

// ------------------------------------------------------------ entrepreneurs

const maria = await must(
  "maria",
  db.from("entrepreneurs").select("id").not("profile_id", "is", null).eq("display_name", "Maria Oliveira").single(),
);

const usedNames = new Set(["Maria Oliveira"]);
const people: { community: string; row: Record<string, unknown> }[] = [];
for (const c of COMMUNITIES) {
  const slots = c.name === COMMUNITIES[0].name ? c.members - 1 : c.members; // Maria takes one in Grajaú
  for (let i = 0; i < slots; i++) {
    let first: string, last: string, name: string;
    do {
      first = pick(FIRST);
      last = pick(LAST);
      name = `${first} ${last}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const sector = c.name === "Rede Feira Viva" || c.name === "Coletivo Sabores da Periferia"
      ? (random() < 0.7 ? "food" : pick(SECTORS))
      : c.kind === "cooperative" ? (random() < 0.6 ? "crafts" : "fashion") : pick(SECTORS);
    people.push({
      community: c.name,
      row: {
        display_name: name,
        business_name: pick(BUSINESS[sector])(first, last),
        business_sector: sector,
        city: c.city,
        state: c.state,
        is_simulated: true,
      },
    });
  }
}
const inserted = await must(
  "entrepreneurs",
  db.from("entrepreneurs").insert(people.map((p) => p.row)).select("id, display_name"),
);
const idByName = new Map(inserted.map((e) => [e.display_name, e.id]));

// Joined after their community was verified, before the pilot window.
const WINDOW_END = new Date("2026-09-10T18:00:00Z");
const memberships = [
  { community_id: byName.get(COMMUNITIES[0].name)!.id, entrepreneur_id: maria.id,
    joined_at: iso(new Date("2026-06-20T14:00:00Z")) },
  ...people.map((p) => {
    const community = byName.get(p.community)!;
    return {
      community_id: community.id,
      entrepreneur_id: idByName.get(p.row.display_name as string)!,
      joined_at: iso(between(new Date(community.verified_at), WINDOW_END)),
    };
  }),
];
await must("memberships", db.from("community_memberships").insert(memberships));

// --------------------------------------------------------------- education

const [readiness] = await must(
  "readiness programme",
  db.from("education_programs").insert({
    title: "Credit readiness",
    description: "EmpowerFI's core preparation track: organise the business, understand its cash, and decide what capital is for before asking for it.",
    is_simulated: true,
  }).select("id"),
);
const coop = byName.get("Cooperativa Mãos que Criam")!;
const [coopProgramme] = await must(
  "cooperative programme",
  db.from("education_programs").insert({
    title: "Cooperative bookkeeping",
    description: "Run by the cooperative: shared records for sales, materials and each member's share.",
    community_id: coop.id,
    is_simulated: true,
  }).select("id"),
);

const readinessModules = await must(
  "readiness modules",
  db.from("education_modules").insert([
    { program_id: readiness.id, position: 1, title: "Separating business and household money", estimated_minutes: 40 },
    { program_id: readiness.id, position: 2, title: "Cash flow: what comes in, what goes out", estimated_minutes: 60 },
    { program_id: readiness.id, position: 3, title: "Pricing and margins", estimated_minutes: 50 },
    { program_id: readiness.id, position: 4, title: "Credit and what it really costs", estimated_minutes: 45 },
    { program_id: readiness.id, position: 5, title: "Planning how capital will be used", estimated_minutes: 45 },
  ]).select("id, position"),
);
const coopModules = await must(
  "cooperative modules",
  db.from("education_modules").insert([
    { program_id: coopProgramme.id, position: 1, title: "Recording shared sales", estimated_minutes: 30 },
    { program_id: coopProgramme.id, position: 2, title: "Materials and stock", estimated_minutes: 30 },
    { program_id: coopProgramme.id, position: 3, title: "Each member's share", estimated_minutes: 40 },
  ]).select("id, position"),
);

readinessModules.sort((a, b) => a.position - b.position);
coopModules.sort((a, b) => a.position - b.position);

// Progress runs in order: most participants are partway through, some have
// finished, a few have not started. Marked by the leader who ran the session.
const leaderOf = new Map(communities.map((c) => [c.id, c.leader_id]));
const progress: Record<string, unknown>[] = [];
const coreDone = new Map<string, number>();
for (const m of memberships) {
  const isMaria = m.entrepreneur_id === maria.id;
  const r = random();
  const done = isMaria ? 5 : r < 0.12 ? 0 : r < 0.35 ? 5 : 1 + Math.floor(random() * 4);
  coreDone.set(m.entrepreneur_id, done);
  const joined = new Date(m.joined_at);
  let at = joined;
  readinessModules.forEach((mod, i) => {
    if (i < done) {
      at = new Date(Math.min(at.getTime() + (4 + random() * 10) * 86_400_000, WINDOW_END.getTime()));
      progress.push({ entrepreneur_id: m.entrepreneur_id, module_id: mod.id, status: "completed",
        started_at: iso(joined), completed_at: iso(at), recorded_by: leaderOf.get(m.community_id) });
    } else if (i === done && done > 0 && random() < 0.5) {
      progress.push({ entrepreneur_id: m.entrepreneur_id, module_id: mod.id, status: "in_progress",
        started_at: iso(at), completed_at: null, recorded_by: leaderOf.get(m.community_id) });
    }
  });
  if (m.community_id === coop.id) {
    const coopDone = Math.floor(random() * 4);
    coopModules.slice(0, coopDone).forEach((mod) => progress.push({
      entrepreneur_id: m.entrepreneur_id, module_id: mod.id, status: "completed",
      started_at: iso(joined), completed_at: iso(between(joined, WINDOW_END)), recorded_by: coop.leader_id,
    }));
  }
}
await must("progress", db.from("education_progress").insert(progress));

// ----------------------------------------------------------------- anchors
// Registration, then verification waiting on it, then each enrollment
// waiting on its community's verification. The pipeline does the rest.

const registrations = await must(
  "registration anchors",
  db.from("chain_anchors").insert(communities.map((c) => ({ kind: "community", entity_id: c.id }))).select("id, entity_id"),
);
const verifications = await must(
  "verification anchors",
  db.from("chain_anchors").insert(registrations.map((r) => ({
    kind: "community_verification", entity_id: r.entity_id, depends_on: r.id,
  }))).select("id, entity_id"),
);
const verificationOf = new Map(verifications.map((v) => [v.entity_id, v.id]));
const enrollments = await must(
  "enrollment anchors",
  db.from("chain_anchors").insert(memberships.map((m) => ({
    kind: "enrollment", entity_id: m.entrepreneur_id, depends_on: verificationOf.get(m.community_id),
  }))).select("id, entity_id"),
);
const enrollmentOf = new Map(enrollments.map((e) => [e.entity_id, e.id]));

// ---------------------------------------------------------------- check-ins
// Six months, April to September, shaped by a business profile. Preparation
// and organisation go together, so the profile depends on education: those
// who finished the programme run tidier books more often.

const SIX = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const whole = (cents: number) => Math.round(cents / 100) * 100;

function profileFor(done: number): string {
  const table: [string, number][] = done === 5
    ? [["steady", 0.6], ["growing", 0.15], ["gaps", 0.08], ["declining", 0.07], ["messy", 0.04], ["stale", 0.03], ["inconsistent", 0.02], ["volatile", 0.01]]
    : [["steady", 0.3], ["growing", 0.05], ["new", 0.25], ["gaps", 0.15], ["declining", 0.1], ["stale", 0.08], ["messy", 0.05], ["inconsistent", 0.01], ["volatile", 0.01]];
  const r = random();
  let acc = 0;
  for (const [name, p] of table) if (r < (acc += p)) return name;
  return "steady";
}

function history(profile: string): CheckinRecord[] {
  const base = 150_000 + Math.floor(random() * 450_000); // R$ 1,500–6,000 a month
  const cogsShare = 0.33 + random() * 0.12;
  const opexShare = 0.08 + random() * 0.07;
  const householdShare = 0.18 + random() * 0.15;
  const days = 18 + Math.floor(random() * 8);
  const month = (period: string, factor: number, over: Partial<CheckinRecord> = {}): CheckinRecord => ({
    period,
    revenue_cents: whole(base * factor),
    cogs_cents: whole(base * factor * cogsShare),
    opex_cents: whole(base * opexShare),
    household_cents: whole(base * householdShare),
    keeps_records: true,
    active_days: days,
    ...over,
  });
  const jitter = () => 0.92 + random() * 0.16;
  switch (profile) {
    case "growing": return SIX.map((p, i) => month(p, (1 + 0.07 * i) * (0.97 + random() * 0.06)));
    case "declining": // sales fall and costs overtake them in the last two months
      return SIX.map((p, i) => i < 4 ? month(p, jitter())
        : month(p, 0.55, { cogs_cents: whole(base * 0.33), opex_cents: whole(base * 0.35) }));
    case "gaps": return ["2026-04", "2026-06", "2026-07", "2026-09"].map((p) => month(p, jitter()));
    case "new": return (random() < 0.5 ? ["2026-09"] : ["2026-08", "2026-09"]).map((p) => month(p, jitter()));
    case "stale": return ["2026-04", "2026-05", "2026-06"].map((p) => month(p, jitter()));
    case "messy": return SIX.map((p, i) => month(p, jitter(), { keeps_records: i % 2 === 0 }));
    case "inconsistent": // two months with no sales but twenty working days
      return SIX.map((p, i) => i === 2 || i === 3
        ? month(p, 0, { revenue_cents: 0, cogs_cents: 0, opex_cents: 0, household_cents: 0, active_days: 20 })
        : month(p, jitter()));
    case "volatile": return SIX.map((p, i) => month(p, [0.2, 2.8, 0.15, 3.0, 0.1, 3.2][i]));
    default: return SIX.map((p) => month(p, jitter()));
  }
}

// Reported a few days after each month closed; September's during September.
const reportedAt = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  const at = new Date(Date.UTC(y, m, 3 + Math.floor(random() * 4), 12));
  return iso(at < WINDOW_END ? at : new Date(WINDOW_END.getTime() - random() * 3 * 86_400_000));
};

// Maria has reported July and August. Her September check-in, done live in
// the demo, is the one that makes her ready.
const MARIA_MONTHS: CheckinRecord[] = [
  { period: "2026-07", revenue_cents: 380_000, cogs_cents: 145_000, opex_cents: 55_000, household_cents: 85_000, keeps_records: true, active_days: 23 },
  { period: "2026-08", revenue_cents: 405_000, cogs_cents: 152_000, opex_cents: 58_000, household_cents: 90_000, keeps_records: true, active_days: 24 },
];
const mariaProfile = profiles.find((p) => p.display_name === "Maria Oliveira");

const histories = new Map<string, { profile: string; months: CheckinRecord[] }>();
for (const m of memberships) {
  if (m.entrepreneur_id === maria.id) histories.set(maria.id, { profile: "maria", months: MARIA_MONTHS });
  else {
    const profile = profileFor(coreDone.get(m.entrepreneur_id)!);
    histories.set(m.entrepreneur_id, { profile, months: history(profile) });
  }
}

// One participant in the second community started reporting only in July:
// ready on three months, which is too little for the eligibility engine to be
// confident about, so her request waits for a person to review it.
const recent = memberships.find((m) =>
  m.community_id === byName.get(COMMUNITIES[1].name)!.id &&
  histories.get(m.entrepreneur_id)!.profile === "steady" && coreDone.get(m.entrepreneur_id) === 5,
)?.entrepreneur_id;
if (recent) histories.get(recent)!.months = histories.get(recent)!.months.slice(-3);

// -------------------------------------------------------------- first cycle
// Six participants of the cooperative and the market network were ready by
// July, borrowed, and have been repaying since: repayment to follow and an
// outcome to measure. Their extra numbers come from a generator of their
// own, and none is in Grajaú, where the live demo happens.

const cycleRandom = rng(20260708);
type Plan = "on_time" | "early_payoff" | "late";
const PLANS: { plan: Plan; after: number; use: string }[] = [
  { plan: "on_time", after: 1.14, use: "as_declared" },
  { plan: "on_time", after: 1.2, use: "as_declared" },
  { plan: "early_payoff", after: 1.1, use: "as_declared" },
  { plan: "on_time", after: 1.03, use: "partly_as_declared" },
  { plan: "late", after: 0.8, use: "other_use" },
  { plan: "on_time", after: 1.08, use: "as_declared" },
];
const cycleCommunities = new Set([byName.get(COMMUNITIES[1].name)!.id, byName.get(COMMUNITIES[2].name)!.id]);
const firstCycle = memberships
  .filter((m) =>
    cycleCommunities.has(m.community_id) && m.entrepreneur_id !== recent &&
    ["steady", "growing"].includes(histories.get(m.entrepreneur_id)!.profile) && coreDone.get(m.entrepreneur_id) === 5)
  .slice(0, PLANS.length)
  .map((membership, i) => ({ membership, ...PLANS[i] }));
const cycleIds = new Set(firstCycle.map((c) => c.membership.entrepreneur_id));

const scale = (c: CheckinRecord, f: number, period = c.period): CheckinRecord =>
  ({ ...c, period, revenue_cents: whole(c.revenue_cents * f), cogs_cents: whole(c.cogs_cents * f) });
for (const c of firstCycle) {
  const id = c.membership.entrepreneur_id;
  const h = histories.get(id)!;
  // Reporting since March; what changed after the loan shows from August.
  h.months = [
    scale(h.months[0], 0.94 + cycleRandom() * 0.08, "2026-03"),
    ...h.months.map((m) => (m.period > "2026-07" ? scale(m, c.after * (0.97 + cycleRandom() * 0.06)) : m)),
  ];
  // Joined the day after her community was verified; finished the course in ten days.
  const community = communities.find((x) => x.id === c.membership.community_id)!;
  const joined = new Date(new Date(community.verified_at).getTime() + 86_400_000);
  c.membership.joined_at = iso(joined);
  await must("first-cycle joined", db.from("community_memberships").update({ joined_at: iso(joined) })
    .eq("entrepreneur_id", id).eq("community_id", community.id));
  for (const [i, mod] of readinessModules.entries()) {
    await must("first-cycle course", db.from("education_progress")
      .update({ started_at: iso(joined), completed_at: iso(new Date(joined.getTime() + 2 * (i + 1) * 86_400_000)) })
      .eq("entrepreneur_id", id).eq("module_id", mod.id));
  }
}

// Months before she joined were brought in when she did.
const joinedOf = new Map(memberships.map((m) => [m.entrepreneur_id, new Date(m.joined_at).getTime()]));
const checkinRows = [...histories.entries()].flatMap(([entrepreneurId, h]) =>
  h.months.map((c) => ({
    ...c,
    entrepreneur_id: entrepreneurId,
    submitted_by: entrepreneurId === maria.id ? mariaProfile?.id : leaderOf.get(memberships.find((m) => m.entrepreneur_id === entrepreneurId)!.community_id),
    is_simulated: true,
    created_at: iso(new Date(Math.max(new Date(reportedAt(c.period)).getTime(), joinedOf.get(entrepreneurId)! + 3_600_000))),
  })),
);
const checkins = await must("check-ins", db.from("checkins").insert(checkinRows).select("id, entrepreneur_id"));
await must(
  "check-in anchors",
  db.from("chain_anchors").insert(checkins.map((c) => ({
    kind: "checkin", entity_id: c.id, depends_on: enrollmentOf.get(c.entrepreneur_id),
  }))),
);

// ------------------------------------------------------ first cycle, credit
// Their July readiness on the months reported by then, a request, the
// eligibility engine, the partner's decision in the partner's name, the loan,
// instalments — then each fact dated to when it happened, and in September
// the outcome measured. The partner signs in here for this and, later, for
// September's referrals.

const publishable = process.env.PLATFORM_PUBLISHABLE_KEY ?? readFileSync(".env", "utf8")
  .split("\n").find((l) => l.startsWith("VITE_PLATFORM_SUPABASE_PUBLISHABLE_KEY="))?.split("=")[1]?.trim();
if (!publishable) throw new Error("no publishable key: set PLATFORM_PUBLISHABLE_KEY or VITE_PLATFORM_SUPABASE_PUBLISHABLE_KEY in .env");
const asPartner = createClient(URL, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: partnerLogin } = await asPartner.auth.signInWithPassword({ email: "partner@demo.empowerfi.io", password: DEMO_PASSWORD });
if (partnerLogin) throw partnerLogin;

const PURPOSE_BY_SECTOR: Record<string, string> = {
  food: "inventory", beauty: "equipment", crafts: "equipment", fashion: "inventory", retail: "working_capital", services: "working_capital",
};
const sectorOf = new Map(people.map((p) => [idByName.get(p.row.display_name as string)!, p.row.business_sector as string]));

const JULY = {
  readiness: "2026-07-06T13:00:00-03:00", intent: "2026-07-07T10:00:00-03:00", eligibility: "2026-07-08T11:00:00-03:00",
  decision: "2026-07-09T14:00:00-03:00", disbursed: "2026-07-10T10:00:00-03:00", active: "2026-07-10T10:05:00-03:00",
};
const PAID_AT = ["2026-08-09T15:00:00-03:00", "2026-09-09T15:00:00-03:00"];
const PAID_OFF_AT = "2026-09-10T09:00:00-03:00";
let cycleLoans = 0;
for (const c of firstCycle) {
  const id = c.membership.entrepreneur_id;
  const { features, result } = assessReadiness({
    as_of_period: "2026-07",
    community_verified: true,
    core_modules_total: readinessModules.length,
    core_modules_completed: readinessModules.length,
    checkins: histories.get(id)!.months.filter((m) => m.period < "2026-07"),
  });
  const r = await must(`first-cycle readiness ${id}`, db.rpc("record_readiness_assessment", {
    p_entrepreneur_id: id, p_features: features, p_result: result, p_is_simulated: true, p_created_at: JULY.readiness,
  })) as { id: string };
  if (result.status !== "CREDIT_READY") continue;

  const [intent] = await must("first-cycle intent", db.from("credit_intents").insert({
    entrepreneur_id: id, purpose: PURPOSE_BY_SECTOR[sectorOf.get(id) ?? "retail"],
    requested_amount_cents: (15 + Math.floor(cycleRandom() * 30)) * 10_000, is_simulated: true, created_at: JULY.intent,
  }).select("id, requested_amount_cents, purpose"));
  const f = features as unknown as Record<string, number | null>;
  const input: EligibilityInput = {
    readiness_status: result.status, readiness_band: result.band,
    requested_amount_cents: intent.requested_amount_cents, purpose: intent.purpose,
    months_reported: f.months_reported as number, records_kept_bps: f.records_kept_bps, inconsistencies: f.inconsistencies as number,
    avg_revenue_cents: f.avg_revenue_cents, avg_net_business_cents: f.avg_net_business_cents,
    avg_household_cents: f.avg_household_cents, revenue_cv_bps: f.revenue_cv_bps,
    revenue_trend_bps: f.revenue_trend_bps, household_share_bps: f.household_share_bps,
  };
  await must("first-cycle eligibility", db.rpc("record_eligibility_assessment", {
    p_entrepreneur_id: id, p_intent_id: intent.id, p_readiness_assessment_id: r.id,
    p_inputs: input, p_result: assessEligibility(input), p_is_simulated: true, p_created_at: JULY.eligibility,
  }));
  const { data: opp } = await db.from("qualified_credit_opportunities")
    .select("id, amount_cents, term_months, status").eq("intent_id", intent.id).maybeSingle();
  if (!opp || opp.status !== "referred") continue;
  await fund(opp.id, 1, 0.25, "2026-07-08T18:00:00-03:00");

  await must("first-cycle approval", asPartner.rpc("partner_decide", {
    p_opportunity_id: opp.id, p_verdict: "approved", p_approved_amount_cents: opp.amount_cents, p_rate_bps: 300,
    p_term_months: c.plan === "early_payoff" ? 3 : opp.term_months, p_reason: "First cycle",
  }));
  const { data: loan, error: loanError } = await asPartner.from("loans")
    .select("id, instalment_cents, term_months").eq("opportunity_id", opp.id).single();
  if (loanError) throw loanError;
  await must("first-cycle disburse", asPartner.rpc("transition_loan", { p_loan_id: loan.id, p_to: "DISBURSED", p_note: "Pix sent" }));
  await must("first-cycle activate", asPartner.rpc("transition_loan", { p_loan_id: loan.id, p_to: "ACTIVE" }));
  const instalments = c.plan === "late" ? 0 : c.plan === "early_payoff" ? loan.term_months : 2;
  for (let n = 1; n <= instalments; n++) {
    await must("first-cycle instalment", asPartner.rpc("record_payment", {
      p_loan_id: loan.id, p_instalment_no: n, p_amount_cents: loan.instalment_cents, p_paid_at: PAID_AT[Math.min(n, 2) - 1],
    }));
  }
  if (c.plan === "early_payoff") {
    await must("first-cycle paid off", asPartner.rpc("transition_loan", { p_loan_id: loan.id, p_to: "PAID", p_note: "Paid off early" }));
  }

  // Dated to when it happened.
  await must("date decision", db.from("partner_decisions").update({ created_at: JULY.decision }).eq("opportunity_id", opp.id));
  await must("date loan", db.from("loans").update({
    created_at: JULY.decision, disbursed_at: JULY.disbursed, updated_at: c.plan === "early_payoff" ? PAID_OFF_AT : JULY.active,
  }).eq("id", loan.id));
  for (const [status, at] of Object.entries({ PARTNER_APPROVED: JULY.decision, DISBURSED: JULY.disbursed, ACTIVE: JULY.active, PAID: PAID_OFF_AT })) {
    await must("date event", db.from("loan_events").update({ created_at: at }).eq("loan_id", loan.id).eq("to_status", status));
  }

  // September: what changed in the business since.
  const outcomeId = await must("first-cycle outcome", db.rpc("measure_outcome", { p_loan_id: loan.id, p_capital_use: c.use }));
  await must("date outcome", db.from("productive_outcomes").update({ measured_at: "2026-09-12T16:00:00-03:00" }).eq("id", outcomeId as string));
  cycleLoans++;
}

// ---------------------------------------------------------------- readiness
// The same engine and the same recording function the live path uses; the
// function queues each attestation behind her registration on chain.

const statusOf = new Map<string, string>();
for (const m of memberships) {
  const { features, result } = assessReadiness({
    as_of_period: "2026-09",
    community_verified: true,
    core_modules_total: readinessModules.length,
    core_modules_completed: coreDone.get(m.entrepreneur_id)!,
    checkins: histories.get(m.entrepreneur_id)!.months,
  });
  await must(`assessment ${m.entrepreneur_id}`, db.rpc("record_readiness_assessment", {
    p_entrepreneur_id: m.entrepreneur_id,
    p_features: features,
    p_result: result,
    p_is_simulated: true,
    p_created_at: "2026-09-12T15:00:00Z",
  }));
  statusOf.set(m.entrepreneur_id, result.status);
}

// ------------------------------------------------------------------ intents
// Some of those who are ready ask for capital; the rest do not, and nothing
// moves them. The first ready participant in Grajaú is kept without a request
// so the demo can show exactly that.

const grajau = byName.get(COMMUNITIES[0].name)!;
const leftAlone = memberships.find(
  (m) => m.community_id === grajau.id && m.entrepreneur_id !== maria.id && statusOf.get(m.entrepreneur_id) === "CREDIT_READY",
)?.entrepreneur_id;

const intents = memberships
  .filter((m) =>
    statusOf.get(m.entrepreneur_id) === "CREDIT_READY" && m.entrepreneur_id !== leftAlone && m.entrepreneur_id !== maria.id &&
    !cycleIds.has(m.entrepreneur_id)) // borrowing already
  .filter((m) => {
    const asks = random() < 0.5; // drawn for everyone, so the sequence does not depend on who is forced in
    return asks || m.entrepreneur_id === recent;
  })
  .map((m) => ({
    entrepreneur_id: m.entrepreneur_id,
    purpose: PURPOSE_BY_SECTOR[sectorOf.get(m.entrepreneur_id) ?? "retail"],
    requested_amount_cents: (10 + Math.floor(random() * 70)) * 10_000, // R$ 1,000–8,000
    is_simulated: true,
    created_at: iso(new Date(Date.UTC(2026, 8, 12, 16) + Math.floor(random() * 36) * 3_600_000)),
  }));
if (intents.length) await must("intents", db.from("credit_intents").insert(intents));

// -------------------------------------------------------------- eligibility
// Every open request goes through the eligibility engine and the same
// recording function the live path uses; that function turns eligible ones
// into opportunities and refers them.

const { data: openIntents, error: intentsError } = await db
  .from("credit_intents").select("id, entrepreneur_id, requested_amount_cents, purpose, created_at").eq("status", "active");
if (intentsError) throw intentsError;
for (const intent of openIntents.filter((i) => !cycleIds.has(i.entrepreneur_id))) {
  const { data: r, error } = await db.from("readiness_assessments")
    .select("id, status, band, features").eq("entrepreneur_id", intent.entrepreneur_id)
    .order("assessment_no", { ascending: false }).limit(1).single();
  if (error) throw error;
  const f = r.features as Record<string, number | null>;
  const input: EligibilityInput = {
    readiness_status: r.status, readiness_band: r.band,
    requested_amount_cents: intent.requested_amount_cents, purpose: intent.purpose,
    months_reported: f.months_reported as number, records_kept_bps: f.records_kept_bps, inconsistencies: f.inconsistencies as number,
    avg_revenue_cents: f.avg_revenue_cents, avg_net_business_cents: f.avg_net_business_cents,
    avg_household_cents: f.avg_household_cents, revenue_cv_bps: f.revenue_cv_bps,
    revenue_trend_bps: f.revenue_trend_bps, household_share_bps: f.household_share_bps,
  };
  await must(`eligibility ${intent.entrepreneur_id}`, db.rpc("record_eligibility_assessment", {
    p_entrepreneur_id: intent.entrepreneur_id, p_intent_id: intent.id, p_readiness_assessment_id: r.id,
    // An hour after she asked: eligibility never comes before the request.
    p_inputs: input, p_result: assessEligibility(input), p_is_simulated: true,
    p_created_at: iso(new Date(new Date(intent.created_at).getTime() + 3_600_000)),
  }));
}

// ------------------------------------------------------------- the partner
// Signed in as the demo partner, through the same RPCs its users call: the
// lending decision is theirs, so the seed takes it in their name. Three
// referrals are left waiting, so the desk is never empty on camera.


const { data: referred, error: referredError } = await db.from("qualified_credit_opportunities")
  .select("id, amount_cents, term_months").eq("status", "referred").order("created_at").order("id");
if (referredError) throw referredError;
const toDecide = referred.slice(0, Math.max(0, referred.length - 3));
let approved = 0, declined = 0;
for (const [i, o] of toDecide.entries()) {
  const disbursing = i % 5 !== 4 && (approved + 1) % 3 >= 1;
  // Declined: partly funded, then refunded. Disbursed: funded in full first.
  // Approved and not yet disbursed: still raising.
  await fund(o.id, i % 5 === 4 ? 0.3 : disbursing ? 1 : 0.6, i % 2 === 0 ? 0.2 : 0, "2026-09-13T12:00:00-03:00");
  if (i % 5 === 4) {
    await must("decline", asPartner.rpc("partner_decide", {
      p_opportunity_id: o.id, p_verdict: "declined", p_reason: "Outside our current sector focus",
    }));
    declined++;
    continue;
  }
  await must("approve", asPartner.rpc("partner_decide", {
    p_opportunity_id: o.id, p_verdict: "approved", p_approved_amount_cents: o.amount_cents,
    p_rate_bps: 300, p_term_months: o.term_months, p_reason: "Pilot cohort",
  }));
  approved++;
  // Loans at different points of their life: approved, disbursed, repaying.
  const { data: loan } = await asPartner.from("loans").select("id, instalment_cents").eq("opportunity_id", o.id).single();
  const stage = approved % 3;
  if (stage >= 1) await must("disburse", asPartner.rpc("transition_loan", { p_loan_id: loan!.id, p_to: "DISBURSED", p_note: "Pix sent" }));
  if (stage === 2) {
    await must("activate", asPartner.rpc("transition_loan", { p_loan_id: loan!.id, p_to: "ACTIVE" }));
    for (let n = 1; n <= 1 + (approved % 2); n++) {
      await must("pay", asPartner.rpc("record_payment", { p_loan_id: loan!.id, p_instalment_no: n, p_amount_cents: loan!.instalment_cents }));
    }
  }
}
// The three awaiting the partner are raising, at different points.
for (const [k, o] of referred.slice(toDecide.length).entries()) {
  await fund(o.id, [0.15, 0.45, 0][k] ?? 0, 0, "2026-09-13T15:00:00-03:00");
}
await asPartner.auth.signOut();

// ----------------------------------------------------------------- capital
// The demo investor funds the partner's book: simulated capital, and marked so.

const investor = profiles.find((p) => p.role === "capital_provider");
const { data: partnerRow } = await db.from("profiles").select("partner_id").eq("role", "partner").not("partner_id", "is", null).limit(1).single();
if (investor && partnerRow?.partner_id) {
  await must("capital", db.from("capital_commitments").insert({
    provider_id: investor.id, partner_id: partnerRow.partner_id, committed_cents: 5_000_000, target_return_bps: 1200, is_simulated: true,
  }));
}

const tally = [...statusOf.values()].reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
const leftAloneName = inserted.find((e) => e.id === leftAlone)?.display_name;

console.log(`communities: ${communities.length}`);
console.log(`participants: ${memberships.length} (including Maria Oliveira)`);
console.log(`education: ${progress.length} progress records`);
console.log(`check-ins: ${checkins.length}`);
console.log(`readiness: ${JSON.stringify(tally)}`);
console.log(`credit intents: ${intents.length}`);
console.log(`partner: ${approved} approved, ${declined} declined, ${referred.length - toDecide.length} awaiting decision`);
console.log(`capital: ${investor ? "R$ 50,000 committed by the demo investor (simulated)" : "no capital provider account"}`);
console.log(`ready and left alone, for the demo: ${leftAloneName ?? "none"} (Grajaú)`);
console.log(`short history, awaiting manual review: ${inserted.find((e) => e.id === recent)?.display_name ?? "none"} (${COMMUNITIES[1].name})`);
console.log(`first cycle: ${cycleLoans} loans since July, outcomes measured in September`);
await must("release the anchor worker", db.rpc("finish_anchor_run"));
const { count: queued } = await db.from("chain_anchors").select("id", { count: "exact", head: true }).eq("status", "pending");
console.log(`anchors queued: ${queued}`);
