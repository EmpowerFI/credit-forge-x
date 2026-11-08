import { describe, expect, it } from "vitest";
import type { PublicCampaign } from "./chain";
import { campaignMoney, campaignProgress, share } from "./money";

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
