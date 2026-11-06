import { assertEquals } from "jsr:@std/assert@1";
import { attestEngagementData, discriminator, engagementRoot } from "./campaign.ts";
import { hex } from "./passport/index.ts";

Deno.test("the discriminator is Anchor's", async () => {
  // sha256("global:attest_engagement"), first 8 bytes.
  const full = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("global:attest_engagement")));
  assertEquals(await discriminator("attest_engagement"), full.slice(0, 8));
});

Deno.test("no one engaged is the zero root", async () => {
  assertEquals(await engagementRoot([]), "0".repeat(64));
});

Deno.test("one leaf is its own leaf hash, and the order matters", async () => {
  const a = "11".repeat(32), b = "22".repeat(32);
  const one = await engagementRoot([a]);
  const leaf = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([0, ...new Uint8Array(32).fill(0x11)])));
  assertEquals(one, hex(leaf));
  assertEquals((await engagementRoot([a, b])) === (await engagementRoot([b, a])), false);
});

Deno.test("the instruction carries the counts little-endian, then the root", async () => {
  const data = await attestEngagementData(6, 2, "ab".repeat(32));
  assertEquals(data.length, 48);
  assertEquals([...data.slice(8, 16)], [6, 0, 0, 0, 2, 0, 0, 0]);
  assertEquals(hex(data.slice(16)), "ab".repeat(32));
});
