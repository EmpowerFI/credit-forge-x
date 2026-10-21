// Generates the secret pg_cron calls journal-reminder with, for one project.
// It goes to two files only -- never printed, never committed.
//
//   npx tsx scripts/whatsapp/generate-reminder-secret.mts ~/.config/empowerfi/journal-reminder-prod.env <project-ref>
//
// writes
//   <file>.env        JOURNAL_REMINDER_SECRET
//                     -> npx supabase secrets set --env-file <file>.env --project-ref <ref> --workdir platform
//   <file>-vault.sql  the two Vault secrets the cron reads
//                     -> run once in that project's SQL Editor, then delete
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [target, ref] = process.argv.slice(2);
if (!target || !ref || !/^[a-z]{20}$/.test(ref)) {
  console.error("usage: npx tsx scripts/whatsapp/generate-reminder-secret.mts <path/to/journal-reminder-<env>.env> <project-ref>");
  process.exit(2);
}
const envPath = resolve(target);
const sqlPath = envPath.replace(/\.env$/, "") + "-vault.sql";
if (envPath.startsWith(resolve("."))) {
  console.error("refusing to write a secret inside the repository; choose a path outside it");
  process.exit(1);
}
for (const p of [envPath, sqlPath]) {
  if (existsSync(p)) {
    console.error(`${p} exists; not overwriting a secret.`);
    process.exit(1);
  }
}

const secret = randomBytes(32).toString("hex");
mkdirSync(dirname(envPath), { recursive: true, mode: 0o700 });
writeFileSync(envPath, `JOURNAL_REMINDER_SECRET=${secret}\n`, { mode: 0o600, flag: "wx" });
writeFileSync(
  sqlPath,
  `-- Run once in the SQL Editor of project ${ref}. Then delete this file.\n` +
    `select vault.create_secret('https://${ref}.supabase.co/functions/v1/journal-reminder', 'journal_reminder_url');\n` +
    `select vault.create_secret('${secret}', 'journal_reminder_secret');\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(`secret written to ${envPath} and ${sqlPath} (mode 600)`);
