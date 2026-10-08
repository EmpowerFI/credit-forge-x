// Renames the demo sponsor and its programme in place, without a reset.
//
//   PLATFORM_SERVICE_KEY_FILE=<file holding the service role key> \
//     npx tsx scripts/platform/rename-demo-sponsor.mts
//
// Why this exists instead of re-running the seed. `seed-demo.mts` opens with
// `reset_demo_data()`, which deletes `zcash_payment_requests` and
// `investments` — every shielded payment the treasury has received and every
// position it funded. It does not delete `zcash_receipts` or
// `zcash_credit_batches`, so a reset leaves receipts whose request is gone and
// batches whose carry no longer belongs to anything: a half-state worse than
// either end of it. Nothing on Zcash is recoverable by re-running a script,
// because the TAZ was really spent.
//
// So the sponsored-cohort demo arrives as two updates to rows that already
// exist. Idempotent: it matches any name the rows have held, so running it
// twice changes nothing the second time.
//
// The sponsor is now the Solana Foundation, named as a hypothesis at the
// founder's decision (8 Oct). It does not sponsor this programme. `is_simulated`
// stays true, the kind becomes `foundation`, and every screen that renders the
// name renders the disclaimer beside it — see `src/app/lib/sponsorship.ts`,
// which is where that is enforced rather than remembered.
//
// `seed-demo-accounts.mts` and `seed-demo.mts` now carry the same names, so a
// future full re-seed of a throwaway database produces this same state. This
// script is for a database with live demo history in it.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
const keyFile = process.env.PLATFORM_SERVICE_KEY_FILE;
if (!keyFile) throw new Error("set PLATFORM_SERVICE_KEY_FILE to a file holding the service role key");
const db = createClient(URL, readFileSync(keyFile, "utf8").trim(), { auth: { persistSession: false } });

// Every name this sponsor has had, so the script is idempotent in whichever
// state it finds the database: the original seed, the NOVA rename, or this one.
const SPONSOR_WAS = ["Instituto Ponte de Impacto (demo)", "NOVA"];
const SPONSOR = { name: "Solana Foundation", kind: "foundation" as const, is_simulated: true };

const PROGRAM_WAS = ["Crescer Juntas 2026 (demo)", "NOVA Women in Business Program"];
// The programme keeps a name of its own rather than the sponsor's. "NOVA Women
// in Business Program" was fine for an invented company; the same pattern with
// a real foundation's name reads as an official named initiative, which is a
// larger claim than the sponsor tile makes and one no disclaimer in a tile can
// reach. A sponsor sponsors a programme; it does not become its title.
const PROGRAM = {
  name: "Women in Business Program",
  description: "Financial readiness and business growth program powered by EmpowerFI.",
  period_end: "2026-11-30",
};

const { data: sponsor, error: findSponsor } = await db
  .from("sponsors").select("id, name").in("name", [...SPONSOR_WAS, SPONSOR.name]).maybeSingle();
if (findSponsor) throw findSponsor;
if (!sponsor) throw new Error(`no sponsor named ${[...SPONSOR_WAS, SPONSOR.name].map((n) => `"${n}"`).join(" or ")} — nothing to rename`);

const { error: updateSponsor } = await db.from("sponsors").update(SPONSOR).eq("id", sponsor.id);
if (updateSponsor) throw updateSponsor;
console.log(`sponsor: "${sponsor.name}" → "${SPONSOR.name}" (${SPONSOR.kind})`);

const { data: program, error: findProgram } = await db
  .from("programs").select("id, name").eq("sponsor_id", sponsor.id)
  .in("name", [...PROGRAM_WAS, PROGRAM.name]).maybeSingle();
if (findProgram) throw findProgram;
if (!program) throw new Error(`no programme named ${[...PROGRAM_WAS, PROGRAM.name].map((n) => `"${n}"`).join(" or ")} under that sponsor — nothing to rename`);

const { error: updateProgram } = await db.from("programs").update(PROGRAM).eq("id", program.id);
if (updateProgram) throw updateProgram;
console.log(`programme: "${program.name}" → "${PROGRAM.name}"`);

// What the participant's card reads from, and the reason the migration exists.
const { count, error: reach } = await db
  .from("program_communities").select("*", { count: "exact", head: true }).eq("program_id", program.id);
if (reach) throw reach;
console.log(`reaching ${count} communities — their members now see the sponsorship card`);
