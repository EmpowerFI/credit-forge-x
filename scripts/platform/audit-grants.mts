// Proves, against a live database, that nothing this repo creates is reachable
// by an anonymous visitor -- the invariant that matters once a real woman's
// figures are in the table.
//
//   DB_URL='postgresql://…' npx tsx scripts/platform/audit-grants.mts
//
// Read-only. It opens one psql session, runs catalog queries and an anon
// row-probe, and exits non-zero on any finding. Run it before every milestone
// that puts real data in a database, in dev and in production.
//
// Why a row-probe and not a grant check. Supabase grants every new table to
// anon and authenticated by default, so the presence of a grant says nothing
// -- row-level security is the real gate. The only honest question is how many
// rows an anonymous caller actually sees, so the script sets role anon and
// counts. Zero on every table this repo owns is the whole invariant; anything
// else is a leak, whatever the grants look like.
//
// Scope. It audits the objects THIS repo creates (parsed from the migrations),
// not the mobile app's tables that share the database. The app has a
// legitimate public surface (its marketplace) and is a separate product; its
// anon-readable tables are expected and out of scope here. What is in scope is
// that none of OUR tables, ever, returns a row to anon.
//
// Exit codes: 0 clean, 1 findings, 2 could not run (no DB_URL, psql missing).

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "platform/supabase/migrations";

// Functions this repo creates in public that are allowed to be callable by an
// anonymous visitor, with the reason each one is safe. Everything else of ours
// that anon can execute is a finding.
const ANON_CALLABLE_ALLOWLIST: Record<string, string> = {
  // 192-bit unguessable token, returns aggregate-only data, revocable.
  shared_audit_report: "share-token gated, aggregate-only",
};

const DB_URL = process.env.DB_URL;
if (!DB_URL) {
  console.error("set DB_URL to the session-pooler connection string (read-only is enough)");
  process.exit(2);
}

// ---------------------------------------------------------------- our objects

/** Every table and every public function name this repo creates. */
function ourObjects(): { tables: string[]; functions: string[] } {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const tables = new Set<string>();
  const functions = new Set<string>();
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi)) {
      tables.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_][a-z0-9_]*)\s*\(/gi)) {
      functions.add(m[1].toLowerCase());
    }
  }
  return { tables: [...tables].sort(), functions: [...functions].sort() };
}

// ------------------------------------------------------------------- psql I/O

/** Runs SQL and returns rows as arrays of column strings. Throws on psql error. */
function query(sql: string): string[][] {
  const out = execFileSync(
    "psql",
    [DB_URL as string, "-v", "ON_ERROR_STOP=1", "-X", "-A", "-F", "\u0001", "-t", "-c", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return out.split("\n").filter((l) => l.length > 0).map((l) => l.split("\u0001"));
}

const literalList = (xs: string[]) => xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(", ") || "''";

// --------------------------------------------------------------------- checks

interface Finding {
  check: string;
  object: string;
  detail: string;
}
const findings: Finding[] = [];
const add = (check: string, object: string, detail: string) => findings.push({ check, object, detail });

function run() {
  const { tables, functions } = ourObjects();
  console.log(`auditing ${tables.length} tables and ${functions.length} functions this repo creates\n`);

  // Confirm the tables actually exist in this database before judging them, so
  // a database that is behind on migrations is reported as such rather than
  // passing vacuously.
  const present = new Set(
    query(
      `select table_name from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE'
          and table_name in (${literalList(tables)})`,
    ).map((r) => r[0]),
  );
  const missing = tables.filter((t) => !present.has(t));
  if (missing.length) {
    console.log(`note: ${missing.length} of our tables are not in this database yet (migrations behind?):`);
    console.log(`  ${missing.join(", ")}\n`);
  }
  const live = tables.filter((t) => present.has(t));

  // 1. RLS enabled on every one of our tables. A table without it is wide open
  //    to anyone the grants admit, which with Supabase defaults is everyone.
  for (const r of query(
    `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
        and c.relname in (${literalList(live)})`,
  )) {
    add("RLS_DISABLED", r[0], "row level security is off on a table this repo owns");
  }

  // 2. The decisive one: how many rows does an anonymous visitor actually see.
  //    Each table is isolated so a permission error on one (a hard deny, which
  //    is good) does not abort the rest. anon_sees > 0 on any of our tables is
  //    a leak.
  const probe = `
    set client_min_messages = warning;
    do $$
    declare t text; n bigint;
    begin
      drop table if exists _audit_anon;
      create temp table _audit_anon(object text, anon_sees bigint);
      foreach t in array array[${literalList(live)}] loop
        begin
          execute 'set local role anon';
          execute format('select count(*) from public.%I', t) into n;
          execute 'reset role';
          if n > 0 then insert into _audit_anon values (t, n); end if;
        exception when others then
          execute 'reset role';   -- hard-denied: the strongest pass, not a finding
        end;
      end loop;
    end $$;
    select object, anon_sees from _audit_anon order by object;`;
  for (const r of query(probe)) {
    // The DO block above also produces psql status noise; a real result row is
    // exactly two fields whose second is the count.
    if (r.length !== 2 || !/^\d+$/.test(r[1])) continue;
    add("ANON_READS_OUR_DATA", r[0], `an anonymous visitor sees ${r[1]} row(s)`);
  }

  // 3. A using(true) policy that applies to anon or PUBLIC hands every row to
  //    logged-out visitors. (The same policy to `authenticated` is fine and is
  //    not flagged -- reference data legitimately reads to signed-in users.)
  for (const r of query(
    `select c.relname, pol.polname
       from pg_policy pol
       join pg_class c on c.oid=pol.polrelid
       join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in (${literalList(live)})
        and btrim(lower(coalesce(pg_get_expr(pol.polqual, pol.polrelid), ''))) = 'true'
        and (0 = any(pol.polroles)
             or coalesce((select oid from pg_roles where rolname='anon'), -1) = any(pol.polroles))`,
  )) {
    add("OPEN_POLICY", r[0], `policy ${r[1]} is using(true) for anon/PUBLIC`);
  }

  // 4. No function this repo creates is executable by an anonymous visitor,
  //    except the allowlist. A NULL proacl is the trap: Postgres defaults a
  //    new function to EXECUTE for PUBLIC, so a function we forgot to revoke is
  //    anon-callable without any grant line to show for it.
  const anonExec = query(
    `select p.proname,
            case when p.proacl is null then 'default (PUBLIC)'
                 else 'granted to anon' end as how
       from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in (${literalList(functions)})
        and (
          p.proacl is null
          or exists (
            select 1 from aclexplode(p.proacl) a
            join pg_roles g on g.oid=a.grantee
            where a.privilege_type='EXECUTE' and g.rolname in ('anon')
          )
          or exists (  -- PUBLIC appears as grantee oid 0 in an explicit ACL
            select 1 from aclexplode(p.proacl) a
            where a.privilege_type='EXECUTE' and a.grantee=0
          )
        )`,
  );
  for (const [name, how] of anonExec) {
    if (name in ANON_CALLABLE_ALLOWLIST) continue;
    add("ANON_CALLABLE_FN", name, `anon can execute this function: ${how}`);
  }

  // 5. The phone table holds no cleartext number. Identity travels as a keyed
  //    HMAC and a cipher, both bytea; a text column whose name looks like a
  //    number would be the cleartext this design exists to avoid.
  if (present.has("whatsapp_identities")) {
    for (const r of query(
      `select column_name, data_type from information_schema.columns
        where table_schema='public' and table_name='whatsapp_identities'
          and data_type in ('text','character varying')
          and column_name ~* '(phone|e164|msisdn|number|tel)'`,
    )) {
      add("CLEARTEXT_PHONE", `whatsapp_identities.${r[0]}`, `a ${r[1]} column that looks like a phone number`);
    }
  }

  // ------------------------------------------------------------------- report
  if (findings.length === 0) {
    console.log("no findings: nothing this repo creates is reachable by an anonymous visitor,");
    console.log("every table of ours has row level security, no policy opens one to the public,");
    console.log("and no function of ours is anon-callable except the allowlisted share report.");
    process.exit(0);
  }

  console.log(`${findings.length} finding(s):\n`);
  for (const f of findings) {
    console.log(`  [${f.check}] ${f.object}`);
    console.log(`      ${f.detail}`);
  }
  console.log("\neach finding is something an anonymous visitor can reach. fix before real data lands.");
  process.exit(1);
}

try {
  run();
} catch (err) {
  console.error("audit could not run:", err instanceof Error ? err.message : String(err));
  process.exit(2);
}
