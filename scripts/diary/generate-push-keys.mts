// Generates, for one project, the keys the diary's reminders are pushed with:
// the VAPID key pair (RFC 8292) and the secret pg_cron calls diary-push with.
// They go to two files only -- never printed, never committed.
//
//   npx tsx scripts/diary/generate-push-keys.mts ~/.config/empowerfi/diary-push-prod.env <project-ref>
//
// writes
//   <file>.env        VAPID_KEYS_B64, DIARY_PUSH_SECRET
//                     -> npx supabase secrets set --env-file <file>.env --project-ref <ref> --workdir platform
//   <file>-vault.sql  the two Vault secrets the cron reads
//                     -> run once in that project's SQL Editor, then delete
//
// Once per project, and kept: every phone subscribes to the public half, so
// new keys silently orphan every subscription until each woman opens the
// diary again. Keep the .env file (it is the only copy of the private key
// outside Supabase), or back it up the way the other keys are.
import { randomBytes, webcrypto } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [target, ref] = process.argv.slice(2);
if (!target || !ref || !/^[a-z]{20}$/.test(ref)) {
  console.error("usage: npx tsx scripts/diary/generate-push-keys.mts <path/to/diary-push-<env>.env> <project-ref>");
  process.exit(2);
}
const envPath = resolve(target);
const sqlPath = envPath.replace(/\.env$/, "") + "-vault.sql";
if (!envPath.endsWith(".env")) {
  console.error("the file name must end in .env");
  process.exit(2);
}
if (envPath.startsWith(resolve("."))) {
  console.error("refusing to write a secret inside the repository; choose a path outside it");
  process.exit(1);
}
for (const p of [envPath, sqlPath]) {
  if (existsSync(p)) {
    console.error(`${p} exists; not overwriting a key. Reusing the existing keys is almost always right.`);
    process.exit(1);
  }
}

// The same JWK pair @negrel/webpush's exportVapidKeys() makes.
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const keys = {
  publicKey: await webcrypto.subtle.exportKey("jwk", pair.publicKey),
  privateKey: await webcrypto.subtle.exportKey("jwk", pair.privateKey),
};
const vapid = Buffer.from(JSON.stringify(keys)).toString("base64url");
const secret = randomBytes(32).toString("hex");

mkdirSync(dirname(envPath), { recursive: true, mode: 0o700 });
writeFileSync(envPath, `VAPID_KEYS_B64=${vapid}\nDIARY_PUSH_SECRET=${secret}\n`, { mode: 0o600, flag: "wx" });
writeFileSync(
  sqlPath,
  `-- Run once in the SQL Editor of project ${ref}. Then delete this file.\n` +
    `select vault.create_secret('https://${ref}.supabase.co/functions/v1/diary-push', 'diary_push_url');\n` +
    `select vault.create_secret('${secret}', 'diary_push_secret');\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(`keys written to ${envPath} and ${sqlPath} (mode 600)`);
