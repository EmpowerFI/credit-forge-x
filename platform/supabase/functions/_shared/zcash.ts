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
