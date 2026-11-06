// The campaign vault's attestation (programs/empowerfi-rewards): the
// instruction the diary signs once a day, and the Merkle root it carries.

import { hex, leafHash, merkleRoot, unhex } from "./passport/index.ts";

const sha256 = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));

/** Anchor's instruction discriminator: the first 8 bytes of sha256("global:<name>"). */
export async function discriminator(name: string): Promise<Uint8Array> {
  return (await sha256(new TextEncoder().encode(`global:${name}`))).slice(0, 8);
}

/**
 * The root of the women who kept the days: an RFC 9162 tree over their leaf
 * commitments (the database's, in its order), as the passport builds its
 * batches. All zero when no one has yet -- the program requires exactly that.
 */
export async function engagementRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return "0".repeat(64);
  return hex(await merkleRoot(await Promise.all(leaves.map((l) => leafHash(unhex(l))))));
}

/** attest_engagement(enrolled: u32, engaged: u32, engagement_root: [u8; 32]). */
export async function attestEngagementData(enrolled: number, engaged: number, root: string): Promise<Uint8Array> {
  const out = new Uint8Array(8 + 4 + 4 + 32);
  out.set(await discriminator("attest_engagement"), 0);
  const view = new DataView(out.buffer);
  view.setUint32(8, enrolled, true);
  view.setUint32(12, engaged, true);
  out.set(unhex(root), 16);
  return out;
}
