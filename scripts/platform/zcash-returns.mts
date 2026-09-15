// Pays back, in shielded ZEC, what EmpowerFI owes investors who paid in ZEC
// and gave a return address: their instalment shares and their refunds.
//
//   PLATFORM_SERVICE_KEY_FILE=<file with the service role key> \
//   ZCASH_DEVTOOL=<zcash-devtool binary> \
//     npx tsx scripts/platform/zcash-returns.mts <treasury-wallet-dir> [--dry-run]
//
// Sending ZEC takes the treasury's spending key, which stays encrypted in the
// devtool wallet on the operator's machine (its age identity decrypts it for
// each send; neither is read or printed here). That is why this runs here,
// by hand, and not in the cloud.
//
// Never sent twice. Each return is claimed — marked sending — before anything
// is sent. If there is no quote or not enough ZEC, it is released untouched.
// A send the node refused ("Send failed") never left, and is released too. If
// it fails in a way that leaves doubt — after sending began, with no refusal —
// it is marked failed for a person to check against the treasury's history,
// never retried.
//
// Priced at CoinGecko's ZEC/USD quote at the moment of sending. There is no
// fallback quote: real testnet ZEC does not leave at a made-up price.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [walletDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
if (!walletDir) {
  console.error("usage: npx tsx scripts/platform/zcash-returns.mts <treasury-wallet-dir> [--dry-run]");
  process.exit(1);
}
const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
const keyFile = process.env.PLATFORM_SERVICE_KEY_FILE;
if (!keyFile) throw new Error("set PLATFORM_SERVICE_KEY_FILE");
const db = createClient(URL, readFileSync(keyFile, "utf8").trim(), { auth: { persistSession: false, autoRefreshToken: false } });
const devtool = process.env.ZCASH_DEVTOOL ?? "zcash-devtool";
const identity = join(walletDir, "age-identity.txt");
const wallet = (args: string[]) =>
  execFileSync(devtool, ["wallet", "-w", walletDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15 * 60_000 });

// A ZIP 317 fee for a shielded send with change, with room to spare.
const FEE_ALLOWANCE_ZAT = 20_000;

console.log("syncing the treasury…");
wallet(["sync", "-s", "zecrocks"]);
const spendable = () => {
  const out = wallet(["balance"]);
  const zec = [...out.matchAll(/(?:Sapling|Orchard|Ironwood) Spendable:\s+([\d.]+)/g)].reduce((n, m) => n + Number(m[1]), 0);
  return Math.round(zec * 1e8);
};
let available = spendable();
console.log(`spendable: ${(available / 1e8).toFixed(8)} ZEC`);

async function quoteCents(): Promise<number | null> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd", { signal: AbortSignal.timeout(5000) });
    const usd = (await res.json())?.zcash?.usd;
    return res.ok && typeof usd === "number" && usd > 0 ? Math.round(usd * 100) : null;
  } catch {
    return null;
  }
}

/** micro-USDC to zatoshis at a quote in US cents per ZEC, rounded up to 1,000 zat, as create_zcash_request does. */
const toZat = (micro: number, cents: number) => Math.ceil((micro * 10_000) / cents / 1000) * 1000;

if (dryRun) {
  const { data, error } = await db.from("zcash_returns").select("id, kind, amount_micro_usdc, status, created_at").eq("status", "due");
  if (error) throw error;
  const cents = await quoteCents();
  for (const r of data) {
    console.log(`${r.kind} ${r.id}: ${(r.amount_micro_usdc / 1e6).toFixed(6)} USDC` + (cents ? ` ≈ ${toZat(r.amount_micro_usdc, cents)} zat` : ""));
  }
  console.log(`${data.length} due${cents ? ` at $${(cents / 100).toFixed(2)}/ZEC` : ", no quote right now"}; nothing sent (dry run)`);
  process.exit(0);
}

const { data: claimed, error } = await db.rpc("zcash_returns_claim", { p_limit: 5 });
if (error) throw error;
if (!claimed?.length) {
  console.log("nothing due");
  process.exit(0);
}

const cents = await quoteCents();
let sent = 0;
// Rejected sends count too: the next one still syncs first.
let attempted = 0;
for (const r of claimed as { id: string; kind: string; amount_micro_usdc: number; address: string; ref: string | null; instalment_no: number | null }[]) {
  if (!cents) {
    await db.rpc("zcash_return_release", { p_id: r.id, p_error: "no ZEC/USD quote" });
    console.log(`${r.id}: released, no quote`);
    continue;
  }
  const zat = toZat(r.amount_micro_usdc, cents);
  if (zat + FEE_ALLOWANCE_ZAT > available) {
    await db.rpc("zcash_return_release", { p_id: r.id, p_error: "not enough spendable ZEC in the treasury" });
    console.log(`${r.id}: released, ${zat} zat needed and ${available} spendable`);
    continue;
  }
  const memo = r.kind === "refund"
    ? `EmpowerFI refund ${r.ref ?? ""}`.trim()
    : `EmpowerFI return ${r.ref ?? ""} instalment ${r.instalment_no ?? "?"}`.replace(/\s+/g, " ");
  let out = "";
  try {
    // A send right after another, on the same sync, was rejected by the node
    // (-25, consensus validation): each send starts from a fresh sync.
    if (attempted++ > 0) wallet(["sync", "-s", "zecrocks"]);
    out = wallet(["send", "-i", identity, "--address", r.address, "--value", String(zat), "--memo", memo, "-s", "zecrocks"]);
  } catch (e) {
    const stdout = String((e as { stdout?: string }).stdout ?? "");
    const stderr = String((e as { stderr?: string }).stderr ?? "");
    const detail = (stderr || stdout).replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300);
    if (stdout.includes("Sending transaction") && !/Send failed/.test(stderr)) {
      // It may have left: a person checks the treasury's history before anything else happens.
      await db.rpc("zcash_return_failed", { p_id: r.id, p_error: `send may have gone out: ${detail}` });
      console.log(`${r.id}: FAILED after sending began — check the treasury with list-tx`);
    } else {
      await db.rpc("zcash_return_release", { p_id: r.id, p_error: detail });
      console.log(`${r.id}: released, the wallet did not send: ${detail}`);
    }
    continue;
  }
  const txid = out.trim().split("\n").reverse().find((l) => /^[0-9a-f]{64}$/.test(l.trim()))?.trim();
  if (!txid) {
    await db.rpc("zcash_return_failed", { p_id: r.id, p_error: "sent, but no transaction id was printed" });
    console.log(`${r.id}: FAILED, no txid in the wallet's output — check the treasury with list-tx`);
    continue;
  }
  const { error: recordError } = await db.rpc("zcash_return_sent", { p_id: r.id, p_txid: txid, p_amount_zat: zat, p_usd_per_zec_cents: cents });
  if (recordError) console.log(`${r.id}: sent ${txid} but not recorded: ${recordError.message}`);
  else console.log(`${r.kind} ${r.ref ?? ""}: ${zat} zat → ${r.address.slice(0, 12)}… · ${txid}`);
  available -= zat + FEE_ALLOWANCE_ZAT;
  sent++;
}
console.log(`${sent} sent at $${cents ? (cents / 100).toFixed(2) : "—"}/ZEC`);
