// Generates the campaign vaults' keys, once per environment. Every secret
// goes to files outside the repository only -- never printed, never committed.
//
//   npx tsx scripts/rewards/generate-keys.mts ~/.config/empowerfi/rewards <project-ref>
//
// writes, in that folder (mode 700, files 600):
//   program-keypair.json     the program's address on devnet (Solana CLI format)
//                            -> solana program deploy --program-id
//   buffer-keypair.json      a fixed deploy buffer, so a failed upload resumes
//                            into the same account instead of stranding its rent
//   sponsor-keypair.json     EmpowerFI's devnet wallet: it creates and funds a
//                            campaign, and EmpowerFI's half belongs to it
//   operator.env             CAMPAIGN_OPERATOR_KEYPAIR, CAMPAIGN_OPERATOR_AUTHORITY,
//                            CAMPAIGN_ATTEST_SECRET
//                            -> npx supabase secrets set --env-file <it> --project-ref <ref> --workdir platform
//   operator-vault.sql       the two Vault secrets the daily cron reads
//                            -> run once in that project's SQL Editor, then delete
//
// and prints the three public addresses. The program id is public: it is
// written into programs/empowerfi-rewards/src/lib.rs and Anchor.toml here,
// so the build that is deployed declares the address it is deployed at. The operator only attests: the
// program has no instruction that takes money out of a vault, so the key
// that lives in the edge function cannot move any.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getAddressDecoder } from "@solana/kit";

const [target, ref] = process.argv.slice(2);
if (!target || !ref || !/^[a-z]{20}$/.test(ref)) {
  console.error("usage: npx tsx scripts/rewards/generate-keys.mts <folder outside the repo> <project-ref>");
  process.exit(2);
}
const dir = resolve(target);
if (dir.startsWith(resolve("."))) {
  console.error("refusing to write a private key inside the repository; choose a folder outside it");
  process.exit(1);
}
const files = {
  program: join(dir, "program-keypair.json"),
  buffer: join(dir, "buffer-keypair.json"),
  sponsor: join(dir, "sponsor-keypair.json"),
  env: join(dir, "operator.env"),
  sql: join(dir, "operator-vault.sql"),
};
for (const p of Object.values(files)) {
  if (existsSync(p)) {
    console.error(`${p} exists; not overwriting a key.`);
    process.exit(1);
  }
}

/** A Solana keypair as the CLI writes it (secret, then public), and its address. */
function keypair(): { bytes: number[]; address: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const d = Buffer.from(privateKey.export({ format: "jwk" }).d!, "base64url");
  const x = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return { bytes: [...d, ...x], address: getAddressDecoder().decode(x) };
}

const program = keypair();
const buffer = keypair();
const sponsor = keypair();
const operator = keypair();
const secret = randomBytes(32).toString("hex");

mkdirSync(dir, { recursive: true, mode: 0o700 });
const write = (path: string, text: string) => writeFileSync(path, text, { mode: 0o600, flag: "wx" });
write(files.program, JSON.stringify(program.bytes));
write(files.buffer, JSON.stringify(buffer.bytes));
write(files.sponsor, JSON.stringify(sponsor.bytes));
write(
  files.env,
  `CAMPAIGN_OPERATOR_KEYPAIR='${JSON.stringify(operator.bytes)}'\nCAMPAIGN_OPERATOR_AUTHORITY=${operator.address}\nCAMPAIGN_ATTEST_SECRET=${secret}\n`,
);
write(
  files.sql,
  `-- Run once in the SQL Editor of project ${ref}. Then delete this file.\n` +
    `select vault.create_secret('https://${ref}.supabase.co/functions/v1/campaign-attest', 'campaign_attest_url');\n` +
    `select vault.create_secret('${secret}', 'campaign_attest_secret');\n`,
);

console.log(`keys written to ${dir} (mode 600)`);
console.log(`program id (public):           ${program.address}`);
console.log(`EmpowerFI sponsor wallet:      ${sponsor.address}`);
console.log(`attesting operator (public):   ${operator.address}`);
console.log("fund the sponsor and the operator with devnet SOL: https://faucet.solana.com");
console.log("and the sponsor with devnet USDC: https://faucet.circle.com (Solana, Devnet)");

// The program declares its own address; a build that does not match is refused on chain.
const lib = "programs/empowerfi-rewards/src/lib.rs";
writeFileSync(lib, readFileSync(lib, "utf8").replace(/declare_id!\("[1-9A-HJ-NP-Za-km-z]+"\)/, `declare_id!("${program.address}")`));
writeFileSync("Anchor.toml", readFileSync("Anchor.toml", "utf8").replace(/^empowerfi_rewards = "[^"]+"$/gm, `empowerfi_rewards = "${program.address}"`));
console.log(`program id written to ${lib} and Anchor.toml: rebuild, then deploy`);
