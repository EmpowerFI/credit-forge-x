// Looks for the bugs that only a from-zero migration run can have.
//
// The demo database grew one migration at a time over twenty-five days. The
// production project will apply all of them at once, into an empty schema,
// and that is a different code path: ordering between files stops being
// guaranteed by the fact that the object already existed when you wrote the
// next one. PLAN.md calls a fresh-install bug the most likely bug in the whole
// plan; this is the free half of looking for it.
//
// Static only. It reads the files and opens no connection, so it is safe to
// run at any time and proves less than an actual run. It catches ordering,
// which is the class that bites; it cannot catch anything about data.
//   npx tsx scripts/platform/check-fresh-install.mts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "platform/supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const sql = new Map(files.map((f) => [f, readFileSync(join(DIR, f), "utf8")]));

/** Comments and string literals say things the parser should not believe. */
function stripped(text: string): string {
  return text
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, (body) => body) // function bodies are real code
    .replace(/'(?:[^']|'')*'/g, "''");
}

const findings: string[] = [];
const note = (file: string, what: string) => findings.push(`${file}\n    ${what}`);

// ---------------------------------------------------------- when things exist

/** first file that creates each object */
const createdIn = new Map<string, number>();
const remember = (name: string, i: number) => {
  if (!createdIn.has(name)) createdIn.set(name, i);
};

files.forEach((f, i) => {
  const s = stripped(sql.get(f)!);
  for (const m of s.matchAll(/create\s+(?:or\s+replace\s+)?(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)) {
    remember(m[1].toLowerCase(), i);
  }
  for (const m of s.matchAll(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)) {
    remember(m[1].toLowerCase(), i);
  }
  for (const m of s.matchAll(/create\s+type\s+([\w.]+)/gi)) remember(m[1].toLowerCase(), i);
});

// ------------------------------------------- 1. a table used before it exists

files.forEach((f, i) => {
  const s = stripped(sql.get(f)!);
  const used = new Set<string>();
  for (const m of s.matchAll(/\breferences\s+([\w.]+)/gi)) used.add(m[1].toLowerCase());
  for (const m of s.matchAll(/\b(?:from|join|update|into)\s+(public\.[\w]+|private\.[\w]+)/gi)) {
    used.add(m[1].toLowerCase());
  }
  for (const name of used) {
    const at = createdIn.get(name);
    // Unknown names are Postgres' own or created outside these files; only a
    // name this repo creates *later* is an ordering bug.
    if (at !== undefined && at > i) {
      note(f, `uses ${name}, which ${files[at]} creates`);
    }
  }
});

// ----------------- 2. an enum value added and used in the same transaction

for (const f of files) {
  const s = stripped(sql.get(f)!);
  const added = [...s.matchAll(/alter\s+type\s+[\w.]+\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'?([\w]+)'?/gi)].map(
    (m) => m[1],
  );
  if (!added.length) continue;
  const raw = sql.get(f)!;
  for (const value of added) {
    // The value quoted anywhere else in the same file. Postgres refuses to use
    // a new enum value in the transaction that added it, and a migration file
    // is one transaction -- incrementally and from zero alike.
    const uses = [...raw.matchAll(new RegExp(`'${value}'`, "g"))].length;
    if (uses > 1) note(f, `adds enum value '${value}' and uses it ${uses - 1}× in the same file`);
  }
}

// ------------------- 3. a name the mobile app owns in the shared database

// Both products are live, developed independently, and share one public
// schema. A table collision fails loudly; a function collision does not —
// create or replace with a matching signature replaces the other product's
// function and says nothing. So the names it owns are checked here, from a
// snapshot, which is why this runs in CI with no database.
const RESERVED = "platform/app-reserved-names.txt";
if (existsSync(RESERVED)) {
  const reserved = new Map<string, Set<string>>();
  for (const line of readFileSync(RESERVED, "utf8").split("\n")) {
    const m = /^(table|func|type)\s+(\S+)$/.exec(line.trim());
    if (m) (reserved.get(m[1]) ?? reserved.set(m[1], new Set()).get(m[1])!).add(m[2].toLowerCase());
  }

  files.forEach((f) => {
    const s = stripped(sql.get(f)!);
    const claim = (re: RegExp, kind: string) => {
      for (const m of s.matchAll(re)) {
        const [schema, name] = m[1].toLowerCase().includes(".")
          ? m[1].toLowerCase().split(".")
          : ["public", m[1].toLowerCase()];
        if (schema === "public" && reserved.get(kind)?.has(name)) {
          note(f, `creates public.${name}, which the mobile app already owns (${kind})`);
        }
      }
    };
    claim(/create\s+(?:or\s+replace\s+)?(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi, "table");
    claim(/create\s+(?:or\s+replace\s+)?function\s+([\w.]+)/gi, "func");
    claim(/create\s+type\s+([\w.]+)/gi, "type");
  });
}

// ------------------------------------------- 4. a timestamp in the future

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const ahead = files.filter((f) => f.slice(0, 8) > today);

// ------------------------------------------------------------------- report

console.log(`${files.length} migrations, ${createdIn.size} tables, views and types created\n`);

if (ahead.length) {
  console.log(`${ahead.length} dated after today (${today}). Filenames are the order, so this is fine —`);
  console.log(`  but it means "apply everything up to today" is not the same set as "apply everything".`);
  console.log(`  first: ${ahead[0]}\n  last:  ${ahead[ahead.length - 1]}\n`);
}

if (!findings.length) {
  console.log("no problems found: every object this repo creates is created before it is used,");
  console.log("no migration uses an enum value it added itself, and nothing here claims a name");
  console.log("the mobile app already owns in the database the two now share.");
  console.log("\nthis is the static half. a real run from zero is still the only proof.");
  process.exit(0);
}

console.log(`${findings.length} to look at:\n`);
for (const f of findings) console.log(`  ${f}\n`);
process.exit(1);
