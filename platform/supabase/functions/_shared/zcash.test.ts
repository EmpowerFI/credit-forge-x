import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { memoParam, parseRawTransaction, paymentUri, txFilterFrame, zecAmount } from "./zcash.ts";

Deno.test("amounts are ZEC with no trailing zeros", () => {
  assertEquals(zecAmount(20_000_000), "0.2");
  assertEquals(zecAmount(876_000), "0.00876");
  assertEquals(zecAmount(100_000_000), "1");
  assertEquals(zecAmount(123_456_789), "1.23456789");
  assertEquals(zecAmount(1), "0.00000001");
  assertThrows(() => zecAmount(-1));
  assertThrows(() => zecAmount(0.5));
});

Deno.test("memos are base64url without padding", () => {
  // "EmpowerFI allocation EFI-ABCDEFGHJK", checked against a standard encoder.
  assertEquals(memoParam("EmpowerFI allocation EFI-ABCDEFGHJK"), "RW1wb3dlckZJIGFsbG9jYXRpb24gRUZJLUFCQ0RFRkdISks");
  assertEquals(memoParam("??>"), "Pz8-");
  assertEquals(memoParam("ç"), "w6c");
  assertThrows(() => memoParam("x".repeat(513)));
});

Deno.test("a payment URI carries the address, the amount, the memo and a message", () => {
  assertEquals(
    paymentUri("utest1abc", 876_000, "EmpowerFI allocation EFI-ABCDEFGHJK", "EmpowerFI EFI-ABCDEFGHJK"),
    "zcash:utest1abc?amount=0.00876&memo=RW1wb3dlckZJIGFsbG9jYXRpb24gRUZJLUFCQ0RFRkdISks&message=EmpowerFI%20EFI-ABCDEFGHJK",
  );
});

// The frame and the parse are pinned against one real exchange with
// testnet.zec.rocks on 2 Oct 2026: the treasury's batch of two allocations,
// txid ac5fdf13…, which the server answered with 12,322 bytes at height
// 4,430,894, transaction version 6.
const REAL_TXID = "ac5fdf13724439adb4cdcb83d8371355f1d6ab0bfa8609aea2f6fb79bee4bdb1";

Deno.test("the transaction id goes to the server reversed", () => {
  const frame = txFilterFrame(REAL_TXID);
  assertEquals(
    [...frame].map((b) => b.toString(16).padStart(2, "0")).join(""),
    "00000000221a20b1bde4be79fbf6a2ae0986fa0babd6f1551337d883cbcdb4ad39447213df5fac",
  );
  // Asking as-displayed is what answers "Transaction not found", so the
  // reversal is the whole call working or not.
  assertEquals(frame.length, 39);
  assertEquals(frame[0], 0);
  assertEquals(frame[5], 0x1a);
  assertEquals(frame[6], 32);
});

Deno.test("a transaction id that is not 64 hex characters is refused", () => {
  assertThrows(() => txFilterFrame(""));
  assertThrows(() => txFilterFrame(REAL_TXID.slice(0, 63)));
  assertThrows(() => txFilterFrame(REAL_TXID + "ab"));
  assertThrows(() => txFilterFrame("z".repeat(64)));
});

/** One RawTransaction frame: `data` of `bytes` length starting with `header`, then `height`. */
function rawTransactionFrame(bytes: number, height: number, header: number[]): Uint8Array {
  const varint = (n: number): number[] => {
    const out: number[] = [];
    while (n > 0x7f) {
      out.push((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    out.push(n);
    return out;
  };
  const data = new Uint8Array(bytes);
  data.set(header, 0);
  const message = Uint8Array.from([0x0a, ...varint(bytes), ...data, 0x10, ...varint(height)]);
  const frame = new Uint8Array(5 + message.length);
  new DataView(frame.buffer).setUint32(1, message.length, false);
  frame.set(message, 5);
  return frame;
}

Deno.test("the server's answer gives the height, the size and the version", () => {
  // 0x80000006 little-endian: version 6 with the overwintered flag set.
  const frame = rawTransactionFrame(12_322, 4_430_894, [0x06, 0x00, 0x00, 0x80]);
  assertEquals(parseRawTransaction(frame), { bytes: 12_322, height: 4_430_894, version: 6 });
});

Deno.test("a version 4 transaction parses too, so the check is not Ironwood-only", () => {
  const frame = rawTransactionFrame(1_024, 4_350_715, [0x04, 0x00, 0x00, 0x80]);
  assertEquals(parseRawTransaction(frame), { bytes: 1_024, height: 4_350_715, version: 4 });
});

Deno.test("a response too short to be a frame is refused rather than guessed at", () => {
  assertThrows(() => parseRawTransaction(new Uint8Array([0, 0, 0])));
});
