// EmpowerFI Missions' campaign vault (programs/empowerfi-rewards), as the
// browser, the Edge Functions and the scripts all speak it: the addresses,
// the campaign's terms and their commitment, the instructions' bytes, and the
// Campaign account's layout. No imports, so the same file runs in all three;
// the Edge Functions' copy is _shared/campaign-vault (npm run platform:sync-shared).

/** The program on Solana devnet. */
export const REWARDS_PROGRAM_ID = "5cWTf64kSqVQSKJW3DoSCs6uyrcXXWXppCMd15yrjAgT";
/** Circle's USDC on devnet. */
export const USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const USDC_DECIMALS = 6;
/** EmpowerFI's wallet: its half of every campaign, and (impact) what is not claimed. */
export const HOUSE_WALLET = "HCzKYj2mhPKB3LjLetpxupa8xCCZNhCqKwVEzMtYuCiL";
/** The key the diary attests engagement with (campaign-attest). */
export const OPERATOR_WALLET = "Ax71Ar1DU2N685CEqmhHwWCtEoibtRVZztcjRqQN3UNb";

export const MIN_SEATS = 100;
export const UNLOCK_DAYS = 30;
export const CAMPAIGN_DAYS = 30;
export const HOUSE_SHARE_BPS = 5000;
/** The least a seat is sold for here (0.01 USDC): the program takes any price above zero. */
export const MIN_PRICE_UNITS = 10_000;

// ------------------------------------------------------------------ base58

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));

/** A campaign's id in the database, as the 16 bytes its address is derived from. */
export function uuidBytes(uuid: string): Uint8Array {
  const h = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/.test(h)) throw new Error(`not a uuid: ${uuid}`);
  return Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
}

// ------------------------------------------------------------------ dates

/** Midnight in São Paulo (UTC−3, no daylight saving) of a calendar day, in Unix seconds. */
export const spMidnight = (day: string) => Math.floor(Date.parse(`${day}T00:00:00-03:00`) / 1000);
/** The calendar day in São Paulo of a Unix time. */
export const spDay = (unix: number) => new Date((unix - 3 * 3600) * 1000).toISOString().slice(0, 10);
/** n days after a calendar day. */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** From the first day's start to the end of the last (the next day's start): 10 Nov to 9 Dec is 30 days. */
export function campaignWindow(startsOn: string, endsOn: string) {
  return { startsAt: spMidnight(startsOn), endsAt: spMidnight(endsOn) + 86_400 };
}

// ------------------------------------------------------------------ terms

export interface Terms {
  campaign: string;
  seats: number;
  pricePerSeatUnits: bigint;
  startsOn: string;
  endsOn: string;
}

/**
 * The campaign's full terms, in the one order anyone can rebuild from the
 * chain account and the database row; their sha256 is the commitment the
 * program stores.
 */
export function termsJson(t: Terms): string {
  return JSON.stringify({
    v: 1, campaign: t.campaign, program: REWARDS_PROGRAM_ID, kind: "impact", seats: t.seats,
    price_per_seat_units: t.pricePerSeatUnits.toString(), mint: USDC_DEVNET_MINT, decimals: USDC_DECIMALS,
    house_share_bps: HOUSE_SHARE_BPS, unlock_days: UNLOCK_DAYS, starts_on: t.startsOn, ends_on: t.endsOn,
    house: HOUSE_WALLET, unclaimed_to: "house",
  });
}

export async function termsCommitment(t: Terms): Promise<Uint8Array> {
  return await sha256(new TextEncoder().encode(termsJson(t)));
}

// ------------------------------------------------------------------ instructions

/** Anchor's instruction discriminator: the first 8 bytes of sha256("global:<name>"). */
export async function discriminator(name: string): Promise<Uint8Array> {
  return (await sha256(new TextEncoder().encode(`global:${name}`))).slice(0, 8);
}

/**
 * create_campaign(campaign_ref: [u8; 16], kind: RewardKind (Impact = 0), price_per_seat: u64,
 * seats: u32, starts_at: i64, ends_at: i64, terms_commitment: [u8; 32]).
 * Accounts: sponsor (signer, writable), operator, house, mint, campaign (writable), system program.
 */
export async function createCampaignData(t: Terms): Promise<Uint8Array> {
  const { startsAt, endsAt } = campaignWindow(t.startsOn, t.endsOn);
  const out = new Uint8Array(8 + 16 + 1 + 8 + 4 + 8 + 8 + 32);
  const v = new DataView(out.buffer);
  out.set(await discriminator("create_campaign"), 0);
  out.set(uuidBytes(t.campaign), 8);
  out[24] = 0;
  v.setBigUint64(25, t.pricePerSeatUnits, true);
  v.setUint32(33, t.seats, true);
  v.setBigInt64(37, BigInt(startsAt), true);
  v.setBigInt64(45, BigInt(endsAt), true);
  out.set(await termsCommitment(t), 53);
  return out;
}

/** fund_campaign(). Accounts: sponsor (signer), campaign (writable), mint, sponsor's USDC (writable), vault (writable), token program. */
export const fundCampaignData = () => discriminator("fund_campaign");

// ------------------------------------------------------------------ rewards

/** Her reward wallet is the program address [RECIPIENT_SEED, her wallet ref]; no key exists for it. */
export const RECIPIENT_SEED = "recipient";
/** One receipt per campaign and wallet: [RECEIPT_SEED, campaign, wallet ref]. */
export const RECEIPT_SEED = "paid";
const LEAF_DOMAIN = "EMPOWERFI:CAMPAIGN_LEAF:v2";

/**
 * Her leaf in a campaign's tree: sha256(LEAF_DOMAIN | campaign id | wallet ref
 * | salt), the same bytes the database (20261226) and the program
 * (leaf_commitment) hash. Hex.
 */
export async function leafCommitment(campaign: string, walletRef: string, saltHex: string): Promise<string> {
  const salt = fromHex(saltHex);
  if (salt.length !== 32) throw new Error("a salt is 32 bytes");
  const domain = new TextEncoder().encode(LEAF_DOMAIN);
  const bytes = new Uint8Array(domain.length + 16 + 16 + 32);
  bytes.set(domain, 0);
  bytes.set(uuidBytes(campaign), domain.length);
  bytes.set(uuidBytes(walletRef), domain.length + 16);
  bytes.set(salt, domain.length + 32);
  return hex(await sha256(bytes));
}

const fromHex = (h: string) => {
  if (!/^([0-9a-f]{2})*$/.test(h)) throw new Error("not lowercase hex");
  return Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
};

/**
 * pay_reward(recipient_ref: [u8; 16], salt: [u8; 32], index: u32, proof: Vec<[u8; 32]>).
 * Accounts: operator (signer, writable), campaign, mint, vault (writable), her
 * wallet, her wallet's token account (writable), receipt (writable), token
 * program, system program.
 */
export async function payRewardData(walletRef: string, saltHex: string, index: number, proofHex: string[]): Promise<Uint8Array> {
  const out = new Uint8Array(8 + 16 + 32 + 4 + 4 + 32 * proofHex.length);
  const v = new DataView(out.buffer);
  out.set(await discriminator("pay_reward"), 0);
  out.set(uuidBytes(walletRef), 8);
  const salt = fromHex(saltHex);
  if (salt.length !== 32) throw new Error("a salt is 32 bytes");
  out.set(salt, 24);
  v.setUint32(56, index, true);
  v.setUint32(60, proofHex.length, true);
  proofHex.forEach((p, i) => {
    const node = fromHex(p);
    if (node.length !== 32) throw new Error("a proof node is 32 bytes");
    out.set(node, 64 + 32 * i);
  });
  return out;
}

/** One woman's reward, as the program pays it: the entrepreneurs' half, split by seats, rounded down. */
export function rewardPerSeat(fundedUnits: bigint, seats: number, houseShareBps = HOUSE_SHARE_BPS): bigint {
  const house = (fundedUnits * BigInt(houseShareBps)) / 10_000n;
  return (fundedUnits - house) / BigInt(seats);
}

// ------------------------------------------------------------------ the account

export interface CampaignAccount {
  campaignRef: string;
  sponsor: string;
  operator: string;
  house: string;
  mint: string;
  vault: string;
  kind: "impact" | "activation";
  pricePerSeat: bigint;
  seats: number;
  houseShareBps: number;
  unlockDays: number;
  startsAt: number;
  endsAt: number;
  termsCommitment: string;
  status: "created" | "funded";
  funded: bigint;
  fundedAt: number;
  enrolled: number;
  engaged: number;
  engagementRoot: string;
  attestedAt: number;
  attestations: number;
}

/** The Campaign account, as the program writes it: an 8-byte discriminator, then Borsh. */
export function decodeCampaign(data: Uint8Array): CampaignAccount {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const bytes = (n: number) => data.subarray(o, (o += n));
  const key = () => base58(bytes(32));
  const u8 = () => data[o++];
  const u16 = () => { const v = view.getUint16(o, true); o += 2; return v; };
  const u32 = () => { const v = view.getUint32(o, true); o += 4; return v; };
  const u64 = () => { const v = view.getBigUint64(o, true); o += 8; return v; };
  const i64 = () => { const v = Number(view.getBigInt64(o, true)); o += 8; return v; };
  return {
    campaignRef: hex(bytes(16)),
    sponsor: key(),
    operator: key(),
    house: key(),
    mint: key(),
    vault: key(),
    kind: u8() === 0 ? "impact" : "activation",
    pricePerSeat: u64(),
    seats: u32(),
    houseShareBps: u16(),
    unlockDays: u16(),
    startsAt: i64(),
    endsAt: i64(),
    termsCommitment: hex(bytes(32)),
    status: u8() === 0 ? "created" : "funded",
    funded: u64(),
    fundedAt: i64(),
    enrolled: u32(),
    engaged: u32(),
    engagementRoot: hex(bytes(32)),
    attestedAt: i64(),
    attestations: u32(),
  };
}

/** What the database records for a campaign the chain confirms, or why it is refused. */
export function checkCampaign(a: CampaignAccount, uuid: string): string | null {
  if (a.campaignRef !== uuid.replace(/-/g, "")) return "not this campaign";
  if (a.kind !== "impact") return "only impact campaigns";
  if (a.status !== "funded") return "not funded";
  if (a.operator !== OPERATOR_WALLET) return "another operator";
  if (a.house !== HOUSE_WALLET) return "another house wallet";
  if (a.mint !== USDC_DEVNET_MINT) return "not devnet USDC";
  if (a.seats < MIN_SEATS) return "fewer than 100 seats";
  if (a.pricePerSeat < BigInt(MIN_PRICE_UNITS)) return "price below 0.01 USDC";
  if (a.houseShareBps !== HOUSE_SHARE_BPS || a.unlockDays !== UNLOCK_DAYS) return "other split or unlock";
  if (a.funded !== a.pricePerSeat * BigInt(a.seats)) return "not funded in full";
  if (a.endsAt - a.startsAt !== CAMPAIGN_DAYS * 86_400) return "not a 30-day campaign";
  return null;
}
