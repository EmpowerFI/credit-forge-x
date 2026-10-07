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
// exist. Idempotent: it matches either the old name or the new one, so running
// it twice changes nothing the second time.
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

const SPONSOR_WAS = "Instituto Ponte de Impacto (demo)";
const SPONSOR = { name: "NOVA", kind: "company" as const, is_simulated: true };

const PROGRAM_WAS = "Crescer Juntas 2026 (demo)";
const PROGRAM = {
  name: "NOVA Women in Business Program",
  description: "Financial readiness and business growth program powered by EmpowerFI.",
  period_end: "2026-11-30",
};

const { data: sponsor, error: findSponsor } = await db
  .from("sponsors").select("id, name").in("name", [SPONSOR_WAS, SPONSOR.name]).maybeSingle();
if (findSponsor) throw findSponsor;
if (!sponsor) throw new Error(`no sponsor named "${SPONSOR_WAS}" or "${SPONSOR.name}" — nothing to rename`);

const { error: updateSponsor } = await db.from("sponsors").update(SPONSOR).eq("id", sponsor.id);
if (updateSponsor) throw updateSponsor;
console.log(`sponsor: "${sponsor.name}" → "${SPONSOR.name}" (${SPONSOR.kind})`);

const { data: program, error: findProgram } = await db
  .from("programs").select("id, name").eq("sponsor_id", sponsor.id)
  .in("name", [PROGRAM_WAS, PROGRAM.name]).maybeSingle();
if (findProgram) throw findProgram;
if (!program) throw new Error(`no programme named "${PROGRAM_WAS}" under that sponsor — nothing to rename`);

const { error: updateProgram } = await db.from("programs").update(PROGRAM).eq("id", program.id);
if (updateProgram) throw updateProgram;
console.log(`programme: "${program.name}" → "${PROGRAM.name}"`);

// What the participant's card reads from, and the reason the migration exists.
const { count, error: reach } = await db
  .from("program_communities").select("*", { count: "exact", head: true }).eq("program_id", program.id);
if (reach) throw reach;
console.log(`reaching ${count} communities — their members now see the sponsorship card`);
