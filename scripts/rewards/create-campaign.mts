// Creates a campaign's vault on Solana devnet and funds it, in one
// transaction signed by EmpowerFI's sponsor wallet, then prints the SQL that
// records it in the database: the campaign, sponsored by EmpowerFI and open
// for women to join from the diary, and its vault (public values only; the
// vault's are all on chain too). The dashboard keeps the name EmpowerFI for
// the house programme, which is why the campaign row comes from here.
//
//   REWARDS_KEYS=~/.config/empowerfi/rewards SOLANA_RPC_URL=<devnet RPC, optional> \
//   npx tsx scripts/rewards/create-campaign.mts \
//     --name "Missão 30 dias" --starts 2026-11-10 --ends 2026-12-09 \
//     --seats 100 --price 0.10 --operator <attesting operator's address>
//
// The vault is the associated USDC account of the campaign's own address, so
// only the program can ever sign for it. The sponsor pays price x seats in
// devnet USDC (Circle's faucet) and a little SOL for rent and fees.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  type Instruction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

// Circle's devnet USDC; REWARDS_MINT only for a local validator's test mint.
const USDC_MINT = address(process.env.REWARDS_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const DECIMALS = 6;
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const PROGRAM_ID = address(
  readFileSync("programs/empowerfi-rewards/src/lib.rs", "utf8").match(/declare_id!\("([1-9A-HJ-NP-Za-km-z]+)"\)/)![1],
);

const { values: a } = parseArgs({
  options: {
    campaign: { type: "string" }, name: { type: "string" }, starts: { type: "string" }, ends: { type: "string" },
    seats: { type: "string", default: "100" }, price: { type: "string" }, operator: { type: "string" },
  },
});
// A new campaign's id; --campaign only to finish one already started.
const uuid = a.campaign ?? randomUUID();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid) || !a.name || !a.starts || !a.ends || !a.price || !a.operator) {
  console.error('usage: --name "Missão 30 dias" --starts YYYY-MM-DD --ends YYYY-MM-DD --seats 100 --price 0.10 --operator <address>');
  process.exit(2);
}
const keys = process.env.REWARDS_KEYS;
if (!keys) throw new Error("set REWARDS_KEYS to the folder generate-keys.mts wrote");

const seats = Number(a.seats);
const [whole, frac = ""] = a.price.split(".");
const price = BigInt(whole) * 10n ** BigInt(DECIMALS) + BigInt((frac + "000000").slice(0, DECIMALS));
// Days in São Paulo: from the first day's start to the end of the last day
// (the next day's start), so 10 Nov to 9 Dec is exactly 30 days.
const startsAt = BigInt(Math.floor(Date.parse(`${a.starts}T00:00:00-03:00`) / 1000));
const endsAt = BigInt(Math.floor(Date.parse(`${a.ends}T00:00:00-03:00`) / 1000)) + 86_400n;
if (seats < 100 || price <= 0n || endsAt - startsAt < 30n * 86_400n) {
  throw new Error("a campaign is at least 100 seats, a price above zero, and at least 30 days");
}

const sponsor = await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(join(keys, "sponsor-keypair.json"), "utf8"))));
const operator = address(a.operator);
const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com");

const ref = Buffer.from(uuid.replace(/-/g, ""), "hex");
const [campaign] = await getProgramDerivedAddress({ programAddress: PROGRAM_ID, seeds: ["campaign", ref] });
const [vault] = await findAssociatedTokenPda({ owner: campaign, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
const [sponsorTokens] = await findAssociatedTokenPda({ owner: sponsor.address, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });

// The terms, as the database and anyone reading the chain can rebuild them.
const terms = {
  v: 1, campaign: uuid, program: PROGRAM_ID, kind: "impact", seats, price_per_seat_units: price.toString(),
  mint: USDC_MINT, decimals: DECIMALS, house_share_bps: 5000, unlock_days: 30, starts_on: a.starts, ends_on: a.ends,
  house: sponsor.address, unclaimed_to: "house",
};
const termsCommitment = createHash("sha256").update(JSON.stringify(terms)).digest();

const disc = (name: string) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };
const i64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(n); return b; };

const create: Instruction = {
  programAddress: PROGRAM_ID,
  accounts: [
    { address: sponsor.address, role: AccountRole.WRITABLE_SIGNER, signer: sponsor } as never,
    { address: operator, role: AccountRole.READONLY },
    { address: sponsor.address, role: AccountRole.READONLY }, // house: EmpowerFI is the sponsor here
    { address: USDC_MINT, role: AccountRole.READONLY },
    { address: campaign, role: AccountRole.WRITABLE },
    { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
  ],
  data: Buffer.concat([disc("create_campaign"), ref, Buffer.from([0]), u64(price), u32(seats), i64(startsAt), i64(endsAt), termsCommitment]),
};
const fund: Instruction = {
  programAddress: PROGRAM_ID,
  accounts: [
    { address: sponsor.address, role: AccountRole.READONLY_SIGNER, signer: sponsor } as never,
    { address: campaign, role: AccountRole.WRITABLE },
    { address: USDC_MINT, role: AccountRole.READONLY },
    { address: sponsorTokens, role: AccountRole.WRITABLE },
    { address: vault, role: AccountRole.WRITABLE },
    { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
  ],
  data: disc("fund_campaign"),
};

if ((await rpc.getAccountInfo(campaign, { encoding: "base64" }).send()).value) {
  console.error(`campaign ${campaign} already exists on chain; nothing sent.`);
  process.exit(1);
}
const makeVault = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: sponsor, owner: campaign, mint: USDC_MINT });
const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
const tx = await signTransactionMessageWithSigners(pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(sponsor, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  (m) => appendTransactionMessageInstructions([create, makeVault, fund], m),
));
const signature = getSignatureFromTransaction(tx);
await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" }).send();
let confirmed = false;
for (let i = 0; i < 40 && !confirmed; i++) {
  const { value: [s] } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
  if (s?.err) throw new Error(`transaction failed: ${JSON.stringify(s.err)}`);
  confirmed = s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized";
  if (!confirmed) await new Promise((r) => setTimeout(r, 1500));
}
if (!confirmed) throw new Error(`not confirmed yet: ${signature}; check it on the explorer before running again`);
const fundedAt = new Date().toISOString();

console.error(`campaign: https://explorer.solana.com/address/${campaign}?cluster=devnet`);
console.error(`vault:    https://explorer.solana.com/address/${vault}?cluster=devnet`);
console.error(`tx:       https://explorer.solana.com/tx/${signature}?cluster=devnet`);
console.error(`campaign id: ${uuid}`);
console.error("\nRun the SQL below in the SQL Editor of the app's project:\n");
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const description =
  "Registre o seu dia no diário por 30 dias. A recompensa da campanha fica guardada num cofre na Solana, reservada para quem cumprir os 30 dias.";
console.log(`begin;
insert into public.programs (id, sponsor_id, name, description, period_start, period_end, enrolment)
select ${q(uuid)}, s.id, ${q(a.name)}, ${q(description)}, ${q(a.starts)}, ${q(a.ends)}, 'open'
  from public.sponsors s where s.is_house;
insert into public.campaign_vaults (program_id, seats, price_per_seat_units, mint_decimals, program_address, campaign_address,
  vault_address, mint, sponsor_wallet, house_wallet, operator_wallet, terms_commitment, created_signature, funded_signature,
  funded_units, funded_at)
values (${q(uuid)}, ${seats}, ${price}, ${DECIMALS}, ${q(PROGRAM_ID)}, ${q(campaign)}, ${q(vault)}, ${q(USDC_MINT)},
  ${q(sponsor.address)}, ${q(sponsor.address)}, ${q(operator)}, ${q(termsCommitment.toString("hex"))}, ${q(signature)}, ${q(signature)},
  ${price * BigInt(seats)}, ${q(fundedAt)});
commit;`);
