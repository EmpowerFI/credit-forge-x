// The wallets behind the tokenised positions.
//
//   PLATFORM_SERVICE_KEY_FILE=<file with the service role key> \
//   OPERATOR_KEYPAIR_FILE=~/empowerfi-hackathon-keys/operator-keypair.json \
//     npx tsx scripts/platform/seed-positions.mts [--investor-wallet <address>]
//
// A position mints only to a wallet the platform has admitted — that is the
// whole point of the frozen-by-default mint — so a freshly seeded database
// has assets that cannot exist yet. This script admits one wallet per investor
// who holds positions and writes it as the owner, and the mint cron does the
// rest, five a minute.
//
// Few wallets, many assets. The seeded funds get a wallet each, derived from
// the operator's secret the same way a mint's key is (functions/position-mint),
// so the same fund is the same address on every machine and nobody else can
// work the address out. They never sign: receiving an asset needs no
// signature, and the platform holds the freeze authority that admits them.
//
// The demo investor is different. On demo day she signs in with a real browser
// wallet, and it is that address — not a derived one — that must be admitted
// before she can fund anything or be handed anything. Pass it with
// --investor-wallet. Without the flag the script keeps whichever wallet
// already holds her assets, so re-running it changes nothing.
//
// Idempotent, and it never moves an asset: a position that has already been
// minted keeps the owner the chain recorded.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";

const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
const DEMO_INVESTOR_EMAIL = "investor@demo.empowerfi.io";

const keyFile = process.env.PLATFORM_SERVICE_KEY_FILE;
if (!keyFile) throw new Error("set PLATFORM_SERVICE_KEY_FILE");
const operatorFile = process.env.OPERATOR_KEYPAIR_FILE;
if (!operatorFile) throw new Error("set OPERATOR_KEYPAIR_FILE");

const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const investorWallet = flag("investor-wallet");
if (investorWallet && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(investorWallet)) {
  throw new Error(`--investor-wallet is not a base58 address: ${investorWallet}`);
}

const db = createClient(URL, readFileSync(keyFile, "utf8").trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const operatorSecret = new Uint8Array(JSON.parse(readFileSync(operatorFile, "utf8"))).slice(0, 32);

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/**
 * A demo fund's wallet, derived rather than generated — the same idiom as a
 * position's mint key. The operator's secret is in the digest, so the address
 * is stable for us and unguessable for anyone else.
 */
async function derive(slug: string): Promise<string> {
  const label = new TextEncoder().encode(`EMPOWERFI:DEMO-WALLET:v1:${slug}`);
  const material = new Uint8Array(operatorSecret.length + label.length);
  material.set(operatorSecret, 0);
  material.set(label, operatorSecret.length);
  const seed = new Uint8Array(await crypto.subtle.digest("SHA-256", material));
  return (await createKeyPairSignerFromPrivateKeyBytes(seed)).address;
}

const slugOf = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ------------------------------------------------------------------- who

interface Row { investor_id: string; owner_wallet: string | null; mint_address: string | null; asset_no: number }

const positions = await must("positions", db.from("credit_positions")
  .select("investor_id, owner_wallet, mint_address, asset_no").order("asset_no")) as Row[];
if (positions.length === 0) {
  console.log("No positions yet. Run seed-demo.mts first — a position appears when an opportunity is fully funded.");
  process.exit(0);
}

const { data: users, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
const demoInvestorId = users.users.find((u) => u.email === DEMO_INVESTOR_EMAIL)?.id ?? null;

const names = new Map<string, string>();
for (const p of await must("profiles", db.from("profiles").select("id, display_name")
  .in("id", [...new Set(positions.map((p) => p.investor_id))])) as { id: string; display_name: string }[]) {
  names.set(p.id, p.display_name);
}

// ---------------------------------------------------------------- admit

const lines: string[] = [];
for (const investorId of [...new Set(positions.map((p) => p.investor_id))]) {
  const mine = positions.filter((p) => p.investor_id === investorId);
  const name = names.get(investorId) ?? investorId;
  const isDemoInvestor = investorId === demoInvestorId;
  const held = mine.find((p) => p.owner_wallet)?.owner_wallet ?? null;

  // The browser wallet wins for the demo investor, because she signs with it.
  // Otherwise keep what is already hers, and derive only when there is nothing.
  const wallet = (isDemoInvestor && investorWallet) || held || await derive(slugOf(name));
  const source = isDemoInvestor && investorWallet ? "browser" : held ? "kept" : "derived";

  await must("admit", db.from("eligible_wallets").upsert({
    wallet,
    label: name.replace(/\s*\(seed\)$/, ""),
    note: isDemoInvestor
      ? "The demo investor's own wallet: she signs her transfers with it"
      : "Devnet demo wallet, derived from the operator's secret; it never signs",
    is_simulated: true,
    active: true,
  }, { onConflict: "wallet" }));

  // A wallet that was hers and is not any more keeps its admission — assets
  // minted to it could never move otherwise — but it stops carrying her name,
  // or the destination list has two rows reading the same thing.
  if (held && held !== wallet) {
    await must("relabel", db.from("eligible_wallets").update({
      label: `${name.replace(/\s*\(seed\)$/, "")} · carteira anterior`,
      note: "Superseded wallet; admitted because assets were minted to it",
    }).eq("wallet", held));
  }

  // Never an asset that already exists: the chain, not this script, says who
  // holds one of those.
  const toClaim = mine.filter((p) => !p.mint_address && p.owner_wallet !== wallet).map((p) => p.asset_no);
  if (toClaim.length > 0) {
    await must("own", db.from("credit_positions")
      .update({ owner_wallet: wallet, mint_error: null })
      .eq("investor_id", investorId).is("mint_address", null).in("asset_no", toClaim));
  }
  const minted = mine.filter((p) => p.mint_address).length;
  lines.push(`  ${name.padEnd(24)} ${wallet}  (${source})`
    + `\n  ${" ".repeat(24)} ${mine.length} positions · ${minted} already on Devnet · ${toClaim.length} queued to mint`);
}

console.log(`admitted ${new Set(positions.map((p) => p.investor_id)).size} wallets:\n${lines.join("\n")}`);
if (!investorWallet) {
  console.log(`\nNo --investor-wallet given. On demo day, pass the address the browser wallet will`
    + `\nsign in with, or the live investment in step 9 cannot mint: its position would be`
    + `\nowned by a wallet the platform has not admitted.`);
}
console.log(`\nThe mint cron runs every minute and takes five at a time.`);
