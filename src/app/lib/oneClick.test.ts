import { afterEach, describe, expect, it, vi } from "vitest";
import { anyWayOut, intoZec, NoRoute, outOfZec, WAYS_IN, WAYS_OUT, ZEC_ASSET } from "./oneClick";

/** A real reply, kept as a vector: 0.02 ZEC to USDC on Solana, 30 Sep 2026. */
const REPLY = {
  quote: {
    amountIn: "2000000", amountInFormatted: "0.02", amountInUsd: "28.538200000000",
    minAmountIn: "2000000", amountOut: "28445898", amountOutFormatted: "28.445898",
    amountOutUsd: "28.439469227052", minAmountOut: "28161439",
    timeEstimate: 452, refundFee: "32000", withdrawFee: "10092",
  },
};

const reply = (body: unknown, status = 201) =>
  vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

/** What the last call actually sent, so the vectors are about the request too. */
const sentBy = (f: ReturnType<typeof reply>) => JSON.parse(String(f.mock.calls[0]?.[1]?.body ?? "{}"));

afterEach(() => vi.unstubAllGlobals());

describe("a crossing", () => {
  it("reads base units and prices the crossing from both sides of the same quote", async () => {
    vi.stubGlobal("fetch", reply(REPLY));
    const c = await outOfZec(2_000_000);
    expect(c.inBase).toBe(2_000_000);
    expect(c.outBase).toBe(28_445_898);
    expect(c.minBase).toBe(28_161_439);
    expect(c.seconds).toBe(452);
    // (28.5382 − 28.43947) / 28.5382: the spread and the withdrawal fee, not a
    // move in the price of either coin.
    expect(c.cost).toBeCloseTo(0.00346, 4);
  });

  it("never asks for a deposit address, so it cannot be paid into", async () => {
    const f = reply(REPLY);
    vi.stubGlobal("fetch", f);
    await outOfZec(2_000_000);
    expect(sentBy(f).dry).toBe(true);
  });

  it("asks for the chain it was given, into ZEC", async () => {
    const f = reply(REPLY);
    vi.stubGlobal("fetch", f);
    await intoZec("arb", 25_000_000);
    const sent = sentBy(f);
    expect(sent.originAsset).toBe(WAYS_IN.find((w) => w.chain === "arb")!.asset);
    expect(sent.destinationAsset).toBe(ZEC_ASSET);
    expect(sent.amount).toBe("25000000");
  });

  it("tells a market that is not offering it apart from a request that failed", async () => {
    // A pair the network does not carry, and one nobody priced just now: both
    // are the market, not a fault. The second one cost a run of MISSes to learn.
    for (const message of ["Quoting for this pair is not available", "Quote error. NO_QUOTE"]) {
      vi.stubGlobal("fetch", reply({ message }, 400));
      await expect(outOfZec(2_000_000)).rejects.toBeInstanceOf(NoRoute);
    }
    vi.stubGlobal("fetch", reply({ message: "recipient is not valid" }, 400));
    const err = await outOfZec(2_000_000).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NoRoute);
  });
});

describe("the way out", () => {
  it("asks Solana first, because that is where these investors hold wallets", () => {
    expect(WAYS_OUT[0].chain).toBe("sol");
  });

  it("falls through to the next chain when nobody prices one, and says which answered", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      n += 1;
      return n === 1
        ? new Response(JSON.stringify({ message: "Quote error. NO_QUOTE" }), { status: 400 })
        : new Response(JSON.stringify(REPLY), { status: 201 });
    }));
    const out = await anyWayOut(2_000_000);
    expect(out.chain).toBe(WAYS_OUT[1].chain);
    expect(out.name).toBe(WAYS_OUT[1].name);
    expect(out.crossing.outBase).toBe(28_445_898);
  });

  it("stops at an error that is not the market, rather than trying three more times", async () => {
    const f = reply({ message: "recipient is not valid" }, 400);
    vi.stubGlobal("fetch", f);
    await expect(anyWayOut(2_000_000)).rejects.toThrow(/recipient/);
    expect(f.mock.calls).toHaveLength(1);
  });

  it("gives up with the market's own answer when no chain prices it", async () => {
    vi.stubGlobal("fetch", reply({ message: "Quote error. NO_QUOTE" }, 400));
    await expect(anyWayOut(2_000_000)).rejects.toBeInstanceOf(NoRoute);
  });
});
