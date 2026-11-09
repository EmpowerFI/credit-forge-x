import { formatDate } from "../i18n";
import type { PublicCampaign } from "./chain";

// What the Missions page says about a campaign's money and its calendar,
// worked out from the database's record and, when devnet answers, the vault's
// balance. Nothing here is invented: every figure is one of those, or a sum
// of them.

export interface CampaignMoney {
  /** What the sponsor paid into the vault. */
  funded: bigint;
  /** EmpowerFI's half: it stays in the vault until the campaign ends. */
  house: bigint;
  /** The entrepreneurs' half. */
  entrepreneurs: bigint;
  /** Each entrepreneur's reward, once she keeps the days. */
  perSeat: bigint;
  /** Rewards already paid into the entrepreneurs' wallets. */
  released: bigint;
  /** The entrepreneurs' half not paid yet. */
  reserved: bigint;
  /** What the vault holds now: the chain's balance, or the record's sum while devnet is not read. */
  inVault: bigint;
  /** Whether inVault is the chain's own balance. */
  fromChain: boolean;
}

export function campaignMoney(c: PublicCampaign, vaultUnits?: bigint | null): CampaignMoney {
  const funded = BigInt(c.chain.funded_units);
  const house = (funded * BigInt(c.house_share_bps)) / 10_000n;
  const entrepreneurs = funded - house;
  const released = BigInt(c.paid.units);
  const reserved = entrepreneurs > released ? entrepreneurs - released : 0n;
  const fromChain = vaultUnits !== undefined && vaultUnits !== null;
  return {
    funded,
    house,
    entrepreneurs,
    perSeat: entrepreneurs / BigInt(c.seats),
    released,
    reserved,
    inVault: fromChain ? vaultUnits : funded - released,
    fromChain,
  };
}

export type CampaignPhase = "upcoming" | "live" | "ended";

/** Where a campaign is in its days, in São Paulo's calendar as the diary keeps it. */
export function campaignProgress(c: Pick<PublicCampaign, "period_start" | "period_end">, now = Date.now()) {
  const start = Date.parse(`${c.period_start.slice(0, 10)}T03:00:00Z`);
  const end = Date.parse(`${c.period_end.slice(0, 10)}T03:00:00Z`);
  const total = Math.round((end - start) / 86_400_000) + 1;
  const day = Math.floor((now - start) / 86_400_000) + 1;
  const phase: CampaignPhase = day < 1 ? "upcoming" : day > total ? "ended" : "live";
  const elapsed = Math.min(Math.max(day, 0), total);
  return { phase, day: Math.min(Math.max(day, 1), total), total, percent: Math.round((elapsed / total) * 100) };
}

/** A share of a whole, as a whole percentage for a bar; 0 when there is no whole. */
export const share = (part: bigint, whole: bigint): number => (whole > 0n ? Number((part * 10_000n) / whole) / 100 : 0);

/** A calendar day (YYYY-MM-DD) as a date, read at noon so no time zone moves it. */
export const day = (d: string) => formatDate(`${d.slice(0, 10)}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" });

/** A campaign as the page shows it: its lead and every published co-sponsorship, each its own vault. */
export interface CampaignGroup {
  lead: PublicCampaign;
  co: PublicCampaign[];
  /** The lead first, then the co-sponsors in the order they joined. */
  vaults: PublicCampaign[];
}

/** Puts each co-sponsorship under its lead; one whose lead is not in the list is left out. */
export function groupCampaigns(list: PublicCampaign[]): CampaignGroup[] {
  const leads = list.filter((c) => !c.joins);
  return leads.map((lead) => {
    const co = list
      .filter((c) => c.joins === lead.program_id)
      .sort((a, b) => Date.parse(a.chain.funded_at) - Date.parse(b.chain.funded_at));
    return { lead, co, vaults: [lead, ...co] };
  });
}

/** The money of every vault in a campaign, added up; each vault's balance from the chain where it was read. */
export function groupMoney(g: CampaignGroup, balances: (bigint | null | undefined)[]): CampaignMoney {
  const parts = g.vaults.map((c, i) => campaignMoney(c, balances[i]));
  const sum = (k: keyof Omit<CampaignMoney, "fromChain">) => parts.reduce((n, m) => n + m[k], 0n);
  return {
    funded: sum("funded"),
    house: sum("house"),
    entrepreneurs: sum("entrepreneurs"),
    perSeat: sum("perSeat"),
    released: sum("released"),
    reserved: sum("reserved"),
    inVault: sum("inVault"),
    fromChain: parts.every((m) => m.fromChain),
  };
}
