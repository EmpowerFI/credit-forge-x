// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  base58, campaignWindow, checkCampaign, createCampaignData, decodeCampaign, discriminator, HOUSE_WALLET, OPERATOR_WALLET,
  leafCommitment, payRewardData, rewardPerSeat, setPayoutData, withdrawHouseData, withdrawRewardData, spDay, termsJson, USDC_DEVNET_MINT, uuidBytes,
} from "./index";

const ID = "0f0e0d0c-0b0a-4908-8706-050403020100";
const terms = { campaign: ID, seats: 100, pricePerSeatUnits: 100_000n, startsOn: "2026-11-09", endsOn: "2026-12-08" };

/** Base58 back to bytes, for the round trip. */
function unbase58(s: string): Uint8Array {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(A.indexOf(c));
  const out: number[] = [];
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of s) { if (c !== "1") break; out.unshift(0); }
  return Uint8Array.from(out);
}

describe("addresses", () => {
  it("writes base58 as Solana does", () => {
    expect(base58(new Uint8Array(32))).toBe("11111111111111111111111111111111");
    for (const a of [HOUSE_WALLET, OPERATOR_WALLET, USDC_DEVNET_MINT]) {
      const b = unbase58(a);
      expect(b.length).toBe(32);
      expect(base58(b)).toBe(a);
    }
  });
});

describe("a 30-day campaign", () => {
  it("runs from the first day's start to the end of the last, in São Paulo", () => {
    const w = campaignWindow("2026-11-09", "2026-12-08");
    expect(w.endsAt - w.startsAt).toBe(30 * 86_400);
    expect(spDay(w.startsAt)).toBe("2026-11-09");
    expect(spDay(w.endsAt - 1)).toBe("2026-12-08");
  });
});

describe("create_campaign", () => {
  it("lays its arguments out as the program reads them", async () => {
    const d = await createCampaignData(terms);
    const v = new DataView(d.buffer);
    expect(d.length).toBe(85);
    expect([...d.subarray(0, 8)]).toEqual([...(await discriminator("create_campaign"))]);
    expect([...d.subarray(8, 24)]).toEqual([...uuidBytes(ID)]);
    expect(d[24]).toBe(0);
    expect(v.getBigUint64(25, true)).toBe(100_000n);
    expect(v.getUint32(33, true)).toBe(100);
    expect(Number(v.getBigInt64(45, true) - v.getBigInt64(37, true))).toBe(30 * 86_400);
  });

  it("commits to terms anyone can rebuild", () => {
    expect(JSON.parse(termsJson(terms))).toMatchObject({ campaign: ID, seats: 100, price_per_seat_units: "100000", house: HOUSE_WALLET, unclaimed_to: "house" });
  });
});

/** A funded campaign account, as the program writes it. */
function account(over: Partial<{ operator: string; seats: number; price: bigint; funded: bigint }> = {}) {
  const out = new Uint8Array(8 + 16 + 160 + 1 + 16 + 16 + 32 + 1 + 16 + 8 + 32 + 12 + 8 + 1);
  const v = new DataView(out.buffer);
  let o = 8;
  out.set(uuidBytes(ID), o); o += 16;
  for (const a of ["E4UiFfUtByFETn4ntvcUrSMFsrN5CSPQRvbMBRUkeSiw", over.operator ?? OPERATOR_WALLET, HOUSE_WALLET, USDC_DEVNET_MINT, HOUSE_WALLET]) {
    out.set(unbase58(a), o); o += 32;
  }
  const seats = over.seats ?? 100, price = over.price ?? 100_000n;
  out[o++] = 0; v.setBigUint64(o, price, true); o += 8; v.setUint32(o, seats, true); o += 4; v.setUint16(o, 5000, true); o += 2; v.setUint16(o, 30, true); o += 2;
  const w = campaignWindow("2026-11-09", "2026-12-08");
  v.setBigInt64(o, BigInt(w.startsAt), true); o += 8; v.setBigInt64(o, BigInt(w.endsAt), true); o += 8; o += 32;
  out[o++] = 1; v.setBigUint64(o, over.funded ?? price * BigInt(seats), true);
  return out;
}

describe("the campaign account", () => {
  it("reads back what the program wrote, and passes the checks", () => {
    const a = decodeCampaign(account());
    expect([a.operator, a.house, a.mint, a.seats, a.pricePerSeat, a.status]).toEqual([OPERATOR_WALLET, HOUSE_WALLET, USDC_DEVNET_MINT, 100, 100_000n, "funded"]);
    expect(checkCampaign(a, ID)).toBeNull();
  });

  it("refuses what the database must not record", () => {
    expect(checkCampaign(decodeCampaign(account()), "11111111-1111-4111-8111-111111111111")).toBe("not this campaign");
    expect(checkCampaign(decodeCampaign(account({ operator: HOUSE_WALLET })), ID)).toBe("another operator");
    expect(checkCampaign(decodeCampaign(account({ price: 9_999n })), ID)).toBe("price below 0.01 USDC");
    expect(checkCampaign(decodeCampaign(account({ funded: 1n })), ID)).toBe("not funded in full");
  });
});

describe("rewards", () => {
  // The same vector is checked by the program's tests and the database's (20261226).
  const LEAF = "da525a5476b8fc4de752bd0bc3a0b682bc0c7e22c5351c3500052670bc24588c";
  it("hashes her leaf as the program and the database do", async () => {
    expect(await leafCommitment("11111111-2222-3333-4444-555555555555", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "07".repeat(32))).toBe(LEAF);
  });
  it("lays pay_reward out as the program reads it", async () => {
    const d = await payRewardData("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "07".repeat(32), 3, ["01".repeat(32), "02".repeat(32)]);
    expect(Array.from(d.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("")).toBe("6b2ac6ba32610da5");
    expect(d.length).toBe(8 + 16 + 32 + 4 + 4 + 64);
    const v = new DataView(d.buffer);
    expect(v.getUint32(56, true)).toBe(3);
    expect(v.getUint32(60, true)).toBe(2);
    expect(d[64]).toBe(1);
    expect(d[96]).toBe(2);
  });
  it("pays half the seat, rounded down, as the program does", () => {
    expect(rewardPerSeat(1_000_000_000n, 100)).toBe(5_000_000n);
    expect(rewardPerSeat(1_000_001n, 100)).toBe(5_000n);
  });
});

describe("paying out", () => {
  // The discriminators the program's IDL gives (anchor build).
  const IDL = { set_payout: [55, 43, 132, 51, 227, 169, 242, 195], withdraw_reward: [191, 187, 176, 137, 9, 25, 187, 244], withdraw_house: [226, 236, 222, 156, 198, 230, 70, 147] };
  const ref = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("lays set_payout out as the program reads it", async () => {
    const d = await setPayoutData(ref, new Uint8Array(32).fill(9));
    expect([...d.slice(0, 8)]).toEqual(IDL.set_payout);
    expect(d.length).toBe(8 + 16 + 32);
    expect([...d.slice(8, 24)]).toEqual([...uuidBytes(ref)]);
    expect(d[55]).toBe(9);
    await expect(setPayoutData(ref, new Uint8Array(31))).rejects.toThrow();
  });

  it("lays withdraw_reward and withdraw_house out as the program reads them", async () => {
    const w = await withdrawRewardData(ref);
    expect([...w.slice(0, 8)]).toEqual(IDL.withdraw_reward);
    expect([...w.slice(8)]).toEqual([...uuidBytes(ref)]);
    expect([...(await withdrawHouseData())]).toEqual(IDL.withdraw_house);
  });
});
