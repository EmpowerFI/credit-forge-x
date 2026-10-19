// Generates the Business Passport's signing key into a local env file, for
// `supabase secrets set --env-file`. The private key is written to that file
// only: never printed, never committed, never in the database.
//
//   npx tsx scripts/passport/generate-key.mts ~/.config/empowerfi/passport-prod.env
//   npx supabase secrets set --env-file ~/.config/empowerfi/passport-prod.env --project-ref <ref>
//
// One key per environment. Prints the public key and its kid, which are public.
// Refuses to overwrite an existing file: replacing a key is a rotation, and a
// rotation keeps the old public key in PASSPORT_RETIRED_KEYS (docs/PASSPORT.md).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateSigningKey, publicJwk } from "../../packages/passport/src/index.ts";

const target = process.argv[2];
if (!target) {
  console.error("usage: npx tsx scripts/passport/generate-key.mts <path/to/passport-<env>.env>");
  process.exit(2);
}
const path = resolve(target);
if (existsSync(path)) {
  console.error(`${path} exists; not overwriting a signing key. See "Rotating the key" in docs/PASSPORT.md.`);
  process.exit(1);
}
if (path.startsWith(resolve("."))) {
  console.error("refusing to write a private key inside the repository; choose a path outside it");
  process.exit(1);
}

const key = await generateSigningKey();
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
writeFileSync(path, `PASSPORT_SIGNING_KEY='${JSON.stringify(key)}'\n`, { mode: 0o600, flag: "wx" });

console.log(`private key written to ${path} (mode 600)`);
console.log(`kid: ${key.kid}`);
console.log(`public key: ${JSON.stringify(publicJwk(key))}`);
