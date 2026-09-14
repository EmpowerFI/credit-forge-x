// Demo scenario, v1: four verified communities, 100 participants, education
// progress — and every community, verification and enrollment queued for the
// chain, so the anchoring pipeline writes real devnet proofs for all of it
// (plan D9: seeded breadth, real anchors).
//
//   PLATFORM_SERVICE_KEY_FILE=<file with the service role key> \
//     npx tsx scripts/platform/seed-demo-v1.mts --yes
//
// Deterministic: the same names, businesses, dates and progress every run,
// from a fixed-seed generator. Chain refs and borrower refs are random, as
// they must be. Starts with reset_demo_data(), which wipes communities,
// members, education and anchors — hence --yes. Accounts and partners stay;
// run seed-demo-accounts.mts first.
//
// Everything is marked is_simulated.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

if (!process.argv.includes("--yes")) {
  console.error("This wipes the demo scenario on the hackathon project. Re-run with --yes.");
  process.exit(1);
}

const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
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
for (const m of memberships) {
  const isMaria = m.entrepreneur_id === maria.id;
  const r = random();
  const done = isMaria ? 5 : r < 0.12 ? 0 : r < 0.35 ? 5 : 1 + Math.floor(random() * 4);
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
await must(
  "enrollment anchors",
  db.from("chain_anchors").insert(memberships.map((m) => ({
    kind: "enrollment", entity_id: m.entrepreneur_id, depends_on: verificationOf.get(m.community_id),
  }))),
);

console.log(`communities: ${communities.length}`);
console.log(`participants: ${memberships.length} (including Maria Oliveira)`);
console.log(`education: ${progress.length} progress records`);
console.log(`anchors queued: ${registrations.length + verifications.length + memberships.length}`);
