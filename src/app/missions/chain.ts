import { type Address, address, getAddressDecoder } from "@solana/kit";
import { diaryDb } from "../diary/db";
import { rpc } from "../lib/solana";

// The campaign vaults (programs/empowerfi-rewards) as the open page reads
// them: the database's record, and the chain's own account, side by side.

export interface Attestation {
  as_of: string;
  enrolled: number;
  engaged: number;
  root: string;
  signature: string;
  block_time: string | null;
}

/** campaign_vaults_public(): counts are null below `min_group` women. */
export interface PublicCampaign {
  program_id: string;
  name: string;
  description: string | null;
  sponsor: string;
  sponsor_is_house: boolean;
  period_start: string;
  period_end: string;
  reward_kind: "impact";
  seats: number;
  price_per_seat_units: number;
  mint_decimals: number;
  house_share_bps: number;
  unlock_days: number;
  min_group: number;
  enrolled: number | null;
  engaged: number | null;
  chain: {
    cluster: "devnet";
    program: string;
    campaign: string;
    vault: string;
    mint: string;
    sponsor_wallet: string;
    house_wallet: string;
    operator_wallet: string;
    terms_commitment: string;
    created_signature: string;
    funded_signature: string;
    funded_units: number;
    funded_at: string;
  };
  attestations: Attestation[];
}

export const missions = {
  campaigns: async (): Promise<PublicCampaign[]> => {
    const { data, error } = await diaryDb.rpc("campaign_vaults_public" as never);
    if (error) throw error;
    return (data ?? []) as PublicCampaign[];
  },
};

/** The Campaign account, as the program writes it (Anchor: 8-byte discriminator, then Borsh). */
export interface CampaignAccount {
  campaignRef: string;
  sponsor: Address;
  operator: Address;
  house: Address;
  mint: Address;
  vault: Address;
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

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function decodeCampaign(data: Uint8Array): CampaignAccount {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const keys = getAddressDecoder();
  let o = 8;
  const bytes = (n: number) => data.subarray(o, (o += n));
  const key = () => keys.decode(bytes(32));
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

/** What the chain says now: the campaign's account and the vault's balance. */
export async function readOnChain(c: PublicCampaign): Promise<{ account: CampaignAccount; vaultUnits: bigint }> {
  const [info, balance] = await Promise.all([
    rpc.getAccountInfo(address(c.chain.campaign), { encoding: "base64" }).send(),
    rpc.getTokenAccountBalance(address(c.chain.vault)).send(),
  ]);
  if (!info.value) throw new Error("campaign account not found on devnet");
  const raw = Uint8Array.from(atob(info.value.data[0]), (ch) => ch.charCodeAt(0));
  return { account: decodeCampaign(raw), vaultUnits: BigInt(balance.value.amount) };
}

/** Where the database and the chain must agree; each entry is a check the page shows. */
export function checks(c: PublicCampaign, a: CampaignAccount, vaultUnits: bigint) {
  const last = c.attestations[0];
  return [
    { key: "ref", ok: a.campaignRef === c.program_id.replace(/-/g, "") },
    { key: "terms", ok: a.termsCommitment === c.chain.terms_commitment },
    { key: "seats", ok: a.seats === c.seats && a.pricePerSeat === BigInt(c.price_per_seat_units) },
    { key: "split", ok: a.houseShareBps === c.house_share_bps && a.unlockDays === c.unlock_days },
    { key: "funded", ok: a.status === "funded" && a.funded === BigInt(c.chain.funded_units) && vaultUnits >= a.funded },
    { key: "proof", ok: last ? a.engagementRoot === last.root && a.engaged === last.engaged : a.attestations === 0 },
  ] as const;
}

/** Token units as a decimal string: 100000 with 6 decimals is "0.10". */
export function units(n: bigint | number, decimals: number): string {
  const v = BigInt(n);
  const whole = v / 10n ** BigInt(decimals);
  const frac = (v % 10n ** BigInt(decimals)).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac.length < 2 ? frac.padEnd(2, "0") : frac}` : ""}`;
}
