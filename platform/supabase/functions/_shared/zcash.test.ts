import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { memoParam, paymentUri, zecAmount } from "./zcash.ts";

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
