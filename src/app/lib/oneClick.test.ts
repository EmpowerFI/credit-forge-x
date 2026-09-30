import { afterEach, describe, expect, it, vi } from "vitest";
import { intoZec, NoRoute, outOfZec, WAYS_IN, ZEC_ASSET } from "./oneClick";

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

  it("tells a pair with no route apart from a request that failed", async () => {
    vi.stubGlobal("fetch", reply({ message: "Quoting for this pair is not available" }, 400));
    await expect(outOfZec(2_000_000)).rejects.toBeInstanceOf(NoRoute);
    vi.stubGlobal("fetch", reply({ message: "recipient is not valid" }, 400));
    const err = await outOfZec(2_000_000).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NoRoute);
  });
});
