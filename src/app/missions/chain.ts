import { address } from "@solana/kit";
import { type CampaignAccount, decodeCampaign, USDC_DECIMALS } from "@empowerfi/campaign-vault";
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

/** One reward paid: into a wallet that is an address of the program, never a person's name. */
export interface Payment {
  recipient: string;
  amount_units: number;
  signature: string;
  block_time: string | null;
}

/** campaign_vaults_public(): counts are null below `min_group` women. */
export interface PublicCampaign {
  program_id: string;
  /** The lead campaign this one co-sponsors (its own vault, the same days), or null for a lead. */
  joins: string | null;
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
  /** The diary's entrepreneurs who share their impact figures: all of them take part. */
  enrolled: number | null;
  /** Those who recorded at least one day in the campaign's window. */
  active: number | null;
  /** Those who kept the campaign's days. */
  engaged: number | null;
  /** The mean of days kept, by those who recorded. */
  avg_days: number | null;
  /** Rewards paid into the entrepreneurs' wallets, confirmed on chain. */
  paid: { count: number; units: number };
  payments: Payment[];
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

export type { CampaignAccount };

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
    // What the vault holds: what was funded, less the rewards paid out of it.
    { key: "funded", ok: a.status === "funded" && a.funded === BigInt(c.chain.funded_units) && vaultUnits >= a.funded - BigInt(c.paid.units) },
    // EmpowerFI's half never leaves the vault by a reward.
    { key: "house", ok: vaultUnits >= (a.funded * BigInt(a.houseShareBps)) / 10_000n },
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

/** "0,10", "0.10" or "1" as USDC base units; null when it is not an amount. */
export function priceUnits(text: string): bigint | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt((frac + "000000").slice(0, USDC_DECIMALS));
}
