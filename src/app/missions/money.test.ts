import { describe, expect, it } from "vitest";
import type { PublicCampaign } from "./chain";
import { campaignMoney, campaignProgress, groupCampaigns, groupMoney, share } from "./money";

const c = {
  seats: 100,
  house_share_bps: 5000,
  period_start: "2026-11-02",
  period_end: "2026-12-01",
  paid: { count: 3, units: 150_000 },
  chain: { funded_units: 10_000_000 },
} as unknown as PublicCampaign;

describe("a campaign's money", () => {
  it("splits what was funded, and keeps paid apart from reserved", () => {
    const m = campaignMoney(c, 9_850_000n);
    expect(m).toMatchObject({ funded: 10_000_000n, house: 5_000_000n, entrepreneurs: 5_000_000n, perSeat: 50_000n });
    expect(m).toMatchObject({ released: 150_000n, reserved: 4_850_000n, inVault: 9_850_000n, fromChain: true });
  });
  it("says what the vault should hold while Solana has not answered", () => {
    expect(campaignMoney(c)).toMatchObject({ inVault: 9_850_000n, fromChain: false });
    expect(campaignMoney(c, null).fromChain).toBe(false);
  });
  it("never reserves less than nothing", () => {
    const over = { ...c, paid: { count: 200, units: 6_000_000 } } as PublicCampaign;
    expect(campaignMoney(over).reserved).toBe(0n);
  });
  it("shares a whole as a percentage, and nothing of nothing", () => {
    expect(share(5_000_000n, 10_000_000n)).toBe(50);
    expect(share(150_000n, 10_000_000n)).toBe(1.5);
    expect(share(1n, 0n)).toBe(0);
  });
});

describe("a campaign's days, in São Paulo", () => {
  const at = (iso: string) => Date.parse(iso);
  it("counts the first day from midnight in São Paulo", () => {
    expect(campaignProgress(c, at("2026-11-02T02:59:00Z")).phase).toBe("upcoming");
    expect(campaignProgress(c, at("2026-11-02T03:00:00Z"))).toMatchObject({ phase: "live", day: 1, total: 30 });
  });
  it("is on day 7 a week in, and ends after day 30", () => {
    expect(campaignProgress(c, at("2026-11-08T15:00:00Z"))).toMatchObject({ phase: "live", day: 7, percent: 23 });
    expect(campaignProgress(c, at("2026-12-01T23:00:00Z"))).toMatchObject({ phase: "live", day: 30, percent: 100 });
    expect(campaignProgress(c, at("2026-12-02T03:00:00Z"))).toMatchObject({ phase: "ended", day: 30, percent: 100 });
  });
});

describe("a campaign with more than one sponsor", () => {
  const vault = (id: string, joins: string | null, funded: number, paid: number, at: string) => ({
    ...c, program_id: id, joins, paid: { count: 0, units: paid },
    chain: { funded_units: funded, funded_at: at },
  }) as unknown as PublicCampaign;
  const lead = vault("L", null, 10_000_000, 150_000, "2026-11-02T10:00:00Z");
  const late = vault("B", "L", 20_000_000, 0, "2026-11-08T10:00:00Z");
  const early = vault("A", "L", 4_000_000, 0, "2026-11-05T10:00:00Z");
  const orphan = vault("O", "gone", 1_000_000, 0, "2026-11-06T10:00:00Z");
  const other = vault("M", null, 1_000_000, 0, "2026-11-01T10:00:00Z");

  it("puts each co-sponsorship under its lead, in the order they joined, and drops one without a lead", () => {
    const groups = groupCampaigns([late, lead, orphan, early, other]);
    expect(groups.map((g) => g.lead.program_id)).toEqual(["L", "M"]);
    expect(groups[0].vaults.map((v) => v.program_id)).toEqual(["L", "A", "B"]);
    expect(groups[1].co).toEqual([]);
  });
  it("adds up the vaults: her reward is the sum of each sponsor's", () => {
    const [g] = groupCampaigns([lead, early, late]);
    const m = groupMoney(g, [9_850_000n, 4_000_000n, undefined]);
    expect(m).toMatchObject({ funded: 34_000_000n, house: 17_000_000n, entrepreneurs: 17_000_000n });
    // 0.05 + 0.02 + 0.10 USDC for 100 seats each.
    expect(m.perSeat).toBe(170_000n);
    expect(m).toMatchObject({ released: 150_000n, reserved: 16_850_000n, inVault: 33_850_000n, fromChain: false });
  });
});
