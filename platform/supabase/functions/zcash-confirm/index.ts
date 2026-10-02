// zcash-confirm — ask a public Zcash server whether a transaction is on chain.
//
//   POST { "txid": "<64 hex>" }   with a signed-in session
//
// Why this exists. A shielded transaction carries no address, no value and no
// memo in the clear, so no block explorer can show one; the Ironwood pool these
// notes use is not indexed on testnet at all. That left the audit table as the
// only record of a Zcash payment, and a table served out of EmpowerFI's own
// database is not evidence about a chain: a reader cannot tell a note decrypted
// with a viewing key from a row somebody typed.
//
// `GetTransaction` needs a transaction id and nothing else — no viewing key, no
// account, nothing of ours. So the question goes to a lightwalletd EmpowerFI
// does not run, and the answer is a third party's: the size of the transaction
// and the height it was mined at. Put beside the height the audit table already
// claims, two independent sources either agree or they do not.
//
// What this does not prove, stated because the screen says it too: that the
// transaction paid *this* treasury. The chain says a transaction exists; only
// the viewing key says what was inside it and who it paid. The two together are
// the whole claim, and neither is the whole claim alone.
//
// A refusal is as useful as a confirmation here. Asking with the id in display
// order rather than reversed answers `grpc-status 5, Transaction not found in
// mempool or best chain`, which is how we know the server really looks instead
// of agreeing with whatever it is handed. So a not-found answer is reported as
// itself, never as an error.
//
// Secrets: ZCASH_LIGHTWALLETD (defaults to the public testnet server).

import { parseRawTransaction, txFilterFrame } from "../_shared/zcash.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const LWD = Deno.env.get("ZCASH_LIGHTWALLETD") ?? "https://testnet.zec.rocks";
const TXID = /^[0-9a-f]{64}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!req.headers.get("Authorization")) return json({ error: "not_signed_in" }, 401);

  let body: { txid?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const txid = body.txid;
  if (typeof txid !== "string" || !TXID.test(txid)) return json({ error: "invalid_txid" }, 400);

  const askedAt = new Date().toISOString();
  let res: Response;
  try {
    res = await fetch(`${LWD}/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetTransaction`, {
      method: "POST",
      headers: { "content-type": "application/grpc", te: "trailers" },
      body: txFilterFrame(txid) as Uint8Array<ArrayBuffer>,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    // The server did not answer. Say so plainly: an unreachable server is not
    // an absent transaction, and conflating the two would be the same mistake
    // the explorer link made.
    return json({ server: LWD, asked_at: askedAt, reachable: false, found: false,
      error: e instanceof Error ? e.message : "unreachable" }, 200);
  }

  const status = res.headers.get("grpc-status");
  const message = res.headers.get("grpc-message");
  const frame = new Uint8Array(await res.arrayBuffer());

  if (!res.ok || (status && status !== "0") || frame.length === 0) {
    return json({
      server: LWD, asked_at: askedAt, reachable: true, found: false,
      grpc_status: status ? Number(status) : null, grpc_message: message,
    });
  }

  try {
    const tx = parseRawTransaction(frame);
    return json({
      server: LWD, asked_at: askedAt, reachable: true, found: true,
      grpc_status: 0, height: tx.height, bytes: tx.bytes, version: tx.version,
    });
  } catch (e) {
    return json({ server: LWD, asked_at: askedAt, reachable: true, found: false,
      error: e instanceof Error ? e.message : "unreadable_answer" }, 200);
  }
});
