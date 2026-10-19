// Generates the Business Passport's anchoring key: the Solana keypair that
// signs each batch's Memo, plus the secret pg_cron calls passport-anchor with.
// Everything secret goes to two files only -- never printed, never committed.
//
//   npx tsx scripts/passport/generate-anchor-key.mts ~/.config/empowerfi/passport-anchor-prod.env <project-ref>
//
// writes
//   <file>.env        PASSPORT_ANCHOR_KEYPAIR, PASSPORT_ANCHOR_AUTHORITY, PASSPORT_ANCHOR_SECRET
//                     -> npx supabase secrets set --env-file <file>.env --project-ref <ref> --workdir platform
//   <file>-vault.sql  the two Vault secrets the cron reads
//                     -> run once in that project's SQL Editor
//
// and prints the authority's public address, to fund on devnet (a Memo costs
// 5,000 lamports; 1 SOL is some 200,000 batches). One key per environment,
// separate from the credit program's operator key.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getAddressDecoder } from "@solana/kit";

const [target, ref] = process.argv.slice(2);
if (!target || !ref || !/^[a-z]{20}$/.test(ref)) {
  console.error("usage: npx tsx scripts/passport/generate-anchor-key.mts <path/to/passport-anchor-<env>.env> <project-ref>");
  process.exit(2);
}
const envPath = resolve(target);
const sqlPath = envPath.replace(/\.env$/, "") + "-vault.sql";
if (envPath.startsWith(resolve("."))) {
  console.error("refusing to write a private key inside the repository; choose a path outside it");
  process.exit(1);
}
for (const p of [envPath, sqlPath]) {
  if (existsSync(p)) {
    console.error(`${p} exists; not overwriting a key.`);
    process.exit(1);
  }
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const d = Buffer.from(privateKey.export({ format: "jwk" }).d!, "base64url");
const x = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
const keypair = [...d, ...x]; // the Solana CLI's format: secret, then public
const authority = getAddressDecoder().decode(x);
const secret = randomBytes(32).toString("hex");

mkdirSync(dirname(envPath), { recursive: true, mode: 0o700 });
writeFileSync(
  envPath,
  `PASSPORT_ANCHOR_KEYPAIR='${JSON.stringify(keypair)}'\nPASSPORT_ANCHOR_AUTHORITY=${authority}\nPASSPORT_ANCHOR_SECRET=${secret}\n`,
  { mode: 0o600, flag: "wx" },
);
writeFileSync(
  sqlPath,
  `-- Run once in the SQL Editor of project ${ref}. Then delete this file.\n` +
    `select vault.create_secret('https://${ref}.supabase.co/functions/v1/passport-anchor', 'passport_anchor_url');\n` +
    `select vault.create_secret('${secret}', 'passport_anchor_secret');\n`,
  { mode: 0o600, flag: "wx" },
);

console.log(`secrets written to ${envPath} and ${sqlPath} (mode 600)`);
console.log(`anchoring authority (public): ${authority}`);
console.log(`fund it on devnet: https://faucet.solana.com (paste the address above)`);
