import { describe, expect, it } from "vitest";
import { getAddressEncoder } from "@solana/kit";
import { decodeCampaign, units } from "./chain";

const A = "E4UiFfUtByFETn4ntvcUrSMFsrN5CSPQRvbMBRUkeSiw";

/** A Campaign account laid out as the program writes it. */
function account(): Uint8Array {
  const out = new Uint8Array(8 + 16 + 32 * 5 + 1 + 8 + 4 + 2 + 2 + 8 + 8 + 32 + 1 + 8 + 8 + 4 + 4 + 32 + 8 + 4 + 8 + 1);
  const v = new DataView(out.buffer);
  let o = 8;
  out.set(new Uint8Array(16).fill(7), o); o += 16;
  for (let i = 0; i < 5; i++) { out.set(getAddressEncoder().encode(A as never), o); o += 32; }
  out[o++] = 0;
  v.setBigUint64(o, 100_000n, true); o += 8;
  v.setUint32(o, 100, true); o += 4;
  v.setUint16(o, 5000, true); o += 2;
  v.setUint16(o, 30, true); o += 2;
  v.setBigInt64(o, 1_700_000_000n, true); o += 8;
  v.setBigInt64(o, 1_702_592_000n, true); o += 8;
  out.set(new Uint8Array(32).fill(0xab), o); o += 32;
  out[o++] = 1;
  v.setBigUint64(o, 10_000_000n, true); o += 8;
  v.setBigInt64(o, 1_700_000_100n, true); o += 8;
  v.setUint32(o, 6, true); o += 4;
  v.setUint32(o, 2, true); o += 4;
  out.set(new Uint8Array(32).fill(0xcd), o); o += 32;
  v.setBigInt64(o, 1_700_100_000n, true); o += 8;
  v.setUint32(o, 3, true);
  return out;
}

describe("the campaign account", () => {
  it("reads every field where the program writes it", () => {
    const c = decodeCampaign(account());
    expect(c.campaignRef).toBe("07".repeat(16));
    expect([c.sponsor, c.vault]).toEqual([A, A]);
    expect([c.kind, c.pricePerSeat, c.seats, c.houseShareBps, c.unlockDays]).toEqual(["impact", 100_000n, 100, 5000, 30]);
    expect((c.endsAt - c.startsAt) / 86_400).toBe(30);
    expect([c.termsCommitment, c.status, c.funded]).toEqual(["ab".repeat(32), "funded", 10_000_000n]);
    expect([c.enrolled, c.engaged, c.engagementRoot, c.attestations]).toEqual([6, 2, "cd".repeat(32), 3]);
  });

  it("writes token amounts as people read them", () => {
    expect(units(100_000n, 6)).toBe("0.10");
    expect(units(10_000_000n, 6)).toBe("10");
    expect(units(5_000_000n, 6)).toBe("5");
    expect(units(1_234_567, 6)).toBe("1.234567");
  });
});
