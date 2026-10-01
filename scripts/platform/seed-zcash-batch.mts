// A batch with a crowd in it: one shielded payment request per demo investor,
// so the demo's batch carries four people rather than one.
//
//   PLATFORM_SERVICE_KEY_FILE=<file with the service role key> \
//     npx tsx scripts/platform/seed-zcash-batch.mts            # preview only
//
//   …same, plus --yes                                          # creates the requests
//
// Spends nothing without --yes. The preview prints what each payment costs in
// testnet ZEC, what the four cost together, and what the batch would then do to
// them — target, credited, carry — so the arithmetic is visible before any TAZ
// moves. Testnet TAZ is scarce and the faucet gives 0.1 a day, so a run that
// turns out to be unaffordable should be found out here and not halfway through.
//
// Why four investors and not four payments by one: a batch's two counts answer
// different questions. Four positions blend their amounts even if one investor
// made them all; it takes four *investors* for the movement's total to belong to
// nobody in particular. The accounts already exist — Irene Costa, who judges log
// in as, and the three seeded funds that hold positions.
//
// A seed artefact, stated rather than hidden: all four are paid from the one
// testnet wallet that holds TAZ. On Zcash the sender is shielded, so nothing in
// the platform or on either chain can tell — which is the property being
// demonstrated, not a gap in it — but the four investors are demo personas and
// the single wallet is why.
//
// The amounts are chosen to leave a remainder: the whole point is that the vault
// is credited in whole units and the rest waits, so a total that divides exactly
// would demonstrate nothing.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import type { Database } from "../../src/app/lib/platform.types";

const URL = process.env.PLATFORM_SUPABASE_URL ?? "https://yuxrujoghizcfdmbkqfg.supabase.co";
const keyFile = process.env.PLATFORM_SERVICE_KEY_FILE;
if (!keyFile) throw new Error("set PLATFORM_SERVICE_KEY_FILE");
const db = createClient<Database>(URL, readFileSync(keyFile, "utf8").trim(), { auth: { persistSession: false } });

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const GO = process.argv.includes("--yes");
/**
 * The unit the vault is credited in. Ten dollars here rather than the thousand
 * zcash-watch defaults to, because testnet TAZ is what it is: a batch has to
 * cross a whole unit for anything to move on Solana, and a unit the demo cannot
 * reach would demonstrate the empty case instead of the mechanism. Production
 * uses a unit large enough to hide behind; this one is large enough to see.
 */
const UNIT = Number(arg("unit") ?? 10_000_000);
/**
 * Micro-USDC per payment: tickets that read like tickets. Sums to $42 against a
 * unit of $10, so $40 is credited and $2 waits — a remainder is the point, since
 * a total that divided exactly would show nothing being carried.
 */
const AMOUNTS = (arg("amounts") ?? "13000000,8000000,11000000,10000000").split(",").map(Number);

const usd = (micro: number) => `$${(micro / 1e6).toFixed(2)}`;
const taz = (zat: number) => `${(zat / 1e8).toFixed(8)} TAZ`;

async function rate(): Promise<{ cents: number; source: "coingecko" | "demo" }> {
  const override = arg("rate");
  if (override) return { cents: Number(override), source: "demo" };
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd");
    const usdPer = (await res.json())?.zcash?.usd;
    if (res.ok && typeof usdPer === "number" && usdPer > 0) return { cents: Math.round(usdPer * 100), source: "coingecko" };
  } catch { /* fall through: the same fallback zcash-request uses */ }
  return { cents: 5000, source: "demo" };
}

const { data: investors, error: investorError } = await db
  .from("profiles").select("id, display_name").eq("role", "capital_provider").order("display_name");
if (investorError) throw new Error(`investors: ${investorError.message}`);
if (!investors?.length) throw new Error("no capital_provider accounts: run seed-demo-accounts.mts and seed-demo.mts first");

const { data: opps, error: oppError } = await db
  .from("qualified_credit_opportunities")
  .select("id, funding_status, funded_micro_usdc, funding_target_micro_usdc, funding_pool")
  .in("funding_status", ["open", "partially_funded"])
  .eq("funding_pool", "global");
if (oppError) throw new Error(`opportunities: ${oppError.message}`);

const total = AMOUNTS.reduce((a, b) => a + b, 0);
const opp = (opps ?? []).find((o) =>
  (o.funding_target_micro_usdc ?? 0) - (o.funded_micro_usdc ?? 0) >= total);
if (!opp) {
  throw new Error(`no open global opportunity with ${usd(total)} of room left — the seed may have filled them all`);
}

const q = await rate();
const zatFor = (micro: number) => Math.round((micro / 1e6) * (100 / q.cents) * 1e8);

const credited = Math.floor(total / UNIT) * UNIT;
console.log(`quote           ${(q.cents / 100).toFixed(2)} USD per ZEC (${q.source})`);
console.log(`unit            ${usd(UNIT)}`);
console.log(`opportunity     ${opp.id} · ${usd((opp.funding_target_micro_usdc ?? 0) - (opp.funded_micro_usdc ?? 0))} of room`);
console.log(`investors       ${Math.min(investors.length, AMOUNTS.length)} of ${investors.length} available\n`);

const plan = AMOUNTS.map((micro, i) => ({
  micro, zat: zatFor(micro),
  investor: investors[i % investors.length],
}));
for (const p of plan) {
  console.log(`  ${usd(p.micro).padStart(7)}  ${taz(p.zat)}  ${p.investor.display_name ?? p.investor.id}`);
}
console.log(`\n  total        ${usd(total)}  ${taz(plan.reduce((a, p) => a + p.zat, 0))}  to pay from the investor wallet`);
console.log(`  the batch    credits ${usd(credited)} and carries ${usd(total - credited)} to the next one`);
if (credited === 0) {
  console.log(`\n  WARNING: under one unit of ${usd(UNIT)}, so nothing would move on Solana and the screen`);
  console.log(`           would say so. Lower --unit or raise --amounts.`);
}
if (new Set(plan.map((p) => p.investor.id)).size < 2) {
  console.log(`\n  WARNING: one investor across every payment, so the movement's total is hers. The`);
  console.log(`           screen will say so, correctly, and the demo will not show a crowd.`);
}

if (!GO) {
  console.log(`\nPreview only. Nothing was created and no TAZ was spent. Re-run with --yes.`);
  process.exit(0);
}

console.log(`\n--- creating ---`);
const uris: string[] = [];
for (const p of plan) {
  const { data, error } = await db.rpc("create_zcash_request", {
    p_investor_id: p.investor.id,
    p_opportunity_id: opp.id,
    p_amount_micro_usdc: p.micro,
    p_usd_per_zec_cents: q.cents,
    p_quote_source: q.source,
  });
  if (error) throw new Error(`request for ${p.investor.display_name}: ${error.message}`);
  const r = data as unknown as { ref: string; address: string; amount_zat: number };
  const uri = `zcash:${r.address}?amount=${(r.amount_zat / 1e8).toFixed(8)}`
    + `&memo=${Buffer.from(`EmpowerFI allocation ${r.ref}`).toString("base64url")}`
    + `&message=${encodeURIComponent(`EmpowerFI ${r.ref}`)}`;
  uris.push(uri);
  console.log(`  ${r.ref}  ${usd(p.micro)}  ${taz(r.amount_zat)}  ${p.investor.display_name}`);
}

console.log(`\n--- pay them, one at a time, from the wallet that holds TAZ ---`);
console.log(`W=~/empowerfi-hackathon-keys/zcash/investor-test`);
console.log(`D=~/empowerfi/zcash-spike/zcash-devtool/target/release/zcash-devtool`);
console.log(`$D wallet -w $W sync        # a stale wallet reports no spendable notes`);
for (const uri of uris) {
  console.log(`$D wallet -w $W pay -i $W/age-identity.txt --payment-uri "${uri}" --disable-confirmation -s zecrocks`);
}
console.log(`\nThen zcash-watch credits them in ONE batch: Audit → Zcash shows the movement,`);
console.log(`and each position's screen names how many investors shared it.`);
