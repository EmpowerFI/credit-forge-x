// ZIP 321 payment URIs, for the zcash-request function and its tests.
// https://zips.z.cash/zip-0321

/** ZEC with up to 8 decimals and no trailing zeros, as ZIP 321 wants it. */
export function zecAmount(zat: number): string {
  if (!Number.isSafeInteger(zat) || zat < 0) throw new Error("invalid amount");
  const whole = Math.floor(zat / 1e8);
  const frac = String(zat % 1e8).padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** A memo parameter: its UTF-8 bytes in base64url, without padding. At most 512 bytes. */
export function memoParam(memo: string): string {
  const bytes = new TextEncoder().encode(memo);
  if (bytes.length > 512) throw new Error("memo longer than 512 bytes");
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A single-payment request to a shielded address: amount, memo, and a message for the payer's wallet. */
export function paymentUri(address: string, zat: number, memo: string, message: string): string {
  return `zcash:${address}?amount=${zecAmount(zat)}&memo=${memoParam(memo)}&message=${encodeURIComponent(message)}`;
}

// --------------------------------------------- asking the chain, with no key

// A block explorer cannot show a shielded transaction: it carries no address,
// no value and no memo in the clear, and the Ironwood pool these notes use is
// not indexed on testnet at all. That left the audit table as the only record,
// and a table read out of EmpowerFI's own database proves nothing about the
// chain — a reader cannot tell a decrypted note from a typed one.
//
// A lightwalletd answers `GetTransaction` from a transaction id alone. No
// viewing key, no account, nothing of ours: the raw transaction and the height
// it was mined at. Pointing that question at a public server turns the claim
// "this is on chain" into something a third party says, which is the part the
// table was missing.
//
// Two details cost an afternoon to find. The id goes in **reversed**: the
// displayed form is the byte-reversed hash, and asking as-displayed answers
// `grpc-status 5, Transaction not found`. That failure is worth keeping in
// mind, because it is also the proof the server is really looking: it says no
// when it has nothing. And the id cannot be recomputed from the bytes here —
// since NU5 a txid is a ZIP 244 digest rather than a double SHA-256, so the
// server's word on the height is the evidence, not a hash we check ourselves.

/** `TxFilter{hash}` as one gRPC frame: flag, big-endian length, then the message. */
export function txFilterFrame(txid: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(txid)) throw new Error("txid must be 64 hex characters");
  const hash = Uint8Array.from(
    (txid.toLowerCase().match(/../g) ?? []).map((b) => parseInt(b, 16)),
  ).reverse();
  const message = Uint8Array.from([0x1a, hash.length, ...hash]); // field 3, length-delimited
  const frame = new Uint8Array(5 + message.length);
  frame[0] = 0; // uncompressed
  new DataView(frame.buffer).setUint32(1, message.length, false);
  frame.set(message, 5);
  return frame;
}

export interface RawTransaction {
  /** Bytes of the transaction itself, as the server holds it. */
  bytes: number;
  /** The block it was mined into, or null when the server did not say. */
  height: number | null;
  /** Transaction version, masked of the overwintered flag: 6 for an Ironwood-era transaction. */
  version: number | null;
}

/** `RawTransaction{data = 1, height = 2}` out of one gRPC response frame. */
export function parseRawTransaction(frame: Uint8Array): RawTransaction {
  if (frame.length < 5) throw new Error("response is shorter than a gRPC frame");
  const length = new DataView(frame.buffer, frame.byteOffset).getUint32(1, false);
  const message = frame.subarray(5, 5 + length);
  let i = 0;
  const varint = (): number => {
    let value = 0;
    let shift = 0;
    for (;;) {
      if (i >= message.length) throw new Error("truncated varint");
      const byte = message[i++];
      value += (byte & 0x7f) * 2 ** shift;
      shift += 7;
      if (!(byte & 0x80)) return value;
    }
  };
  let bytes = 0;
  let height: number | null = null;
  let version: number | null = null;
  while (i < message.length) {
    const tag = varint();
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 2) {
      const size = varint();
      if (field === 1) {
        bytes = size;
        // The header is a little-endian uint32 whose top bit is the overwintered flag.
        if (size >= 4) {
          version = new DataView(message.buffer, message.byteOffset + i, 4).getUint32(0, true) & 0x7fffffff;
        }
      }
      i += size;
    } else if (wire === 0) {
      const value = varint();
      if (field === 2) height = value;
    } else {
      break; // nothing else in this message is read
    }
  }
  return { bytes, height, version };
}
