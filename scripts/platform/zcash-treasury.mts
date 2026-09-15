// Points EmpowerFI's database at its shielded treasury on Zcash: the unified
// address investors pay, the viewing key the watcher and auditors read with,
// and the height to start scanning from.
//
//   node scripts/platform/zcash-treasury.mts <wallet-dir> [--local]
//
// The wallet is a zcash-devtool wallet kept outside the repository (its seed
// stays encrypted there and is never read here). ZCASH_DEVTOOL names the
// devtool binary. Without --local it writes to the linked hackathon project
// through the Supabase CLI; with --local, to the local stack's database.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [walletDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const local = process.argv.includes("--local");
if (!walletDir) {
  console.error("usage: node scripts/platform/zcash-treasury.mts <wallet-dir> [--local]");
  process.exit(1);
}
const devtool = process.env.ZCASH_DEVTOOL ?? "zcash-devtool";
const run = (args: string[]) => execFileSync(devtool, ["wallet", "-w", walletDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

const address = run(["list-addresses"]).match(/Default Address:\s+(\S+)/)?.[1];
const ufvk = run(["list-accounts"]).match(/UFVK:\s+(\S+)/)?.[1];
const keys = readFileSync(join(walletDir, "keys.toml"), "utf8");
const network = keys.match(/^network\s*=\s*"(\w+)"/m)?.[1];
const birthday = keys.match(/^birthday\s*=\s*(\d+)/m)?.[1];
if (!address || !ufvk || !network || !birthday) throw new Error("could not read the address, viewing key, network and birthday from the wallet");
for (const [name, value] of [["address", address], ["ufvk", ufvk]]) {
  if (!/^[0-9a-z]+$/.test(value)) throw new Error(`unexpected characters in the ${name}`);
}

const sql = `select public.zcash_configure_treasury('${network}', '${address}', '${ufvk}', ${Number(birthday)})`;
if (local) {
  execFileSync("docker", ["exec", "-i", "supabase_db_empowerfi-platform", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-c", sql],
    { stdio: ["ignore", "ignore", "inherit"] });
} else {
  execFileSync("npx", ["--no-install", "supabase", "db", "query", "--linked", "--workdir", "platform", sql],
    { stdio: ["ignore", "ignore", "inherit"] });
}
console.log(`treasury set (${local ? "local" : "linked"}): ${network}net ${address.slice(0, 14)}…, scanning from ${birthday}`);
