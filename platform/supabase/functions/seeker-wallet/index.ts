// seeker-wallet — the Seeker app connects the wallet on her phone
// (PLAN_SEEKER.md §3.2, migration 20270116000000).
//
//   { action: "challenge", address }    the message for her wallet to sign: five
//                                        minutes, a nonce used once
//   { action: "verify", signature }     her wallet's signature of it (base64);
//                                        if it is hers, the wallet is recorded with
//                                        the automatic transfer on, and asked for as
//                                        her payout destination (diary_payout_set,
//                                        as the web diary does); before her first
//                                        reward it waits for it
//
// Called by the Seeker app with her session. No transaction is signed and no
// key is held here: the signature proves the wallet, the program's 24 hours
// guard the destination.
//
// Secrets: none of its own. SEEKER_ORIGIN (optional) is the site the message
// names; SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are the platform's.

import { createClient } from "@supabase/supabase-js";
import { base64Bytes, challengeMessage, isAddress, newNonce, signedBy } from "../_shared/seeker-wallet.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const ORIGIN = Deno.env.get("SEEKER_ORIGIN") ?? "https://empowerfi-seeker-dev.vercel.app";

/** The reason a database call refused, by the code its message starts with. */
const reason = (message: string) => message.split(/[\s:]/)[0];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "not_signed_in" }, 401);
  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);
  const user = who.user.id;

  let body: { action?: unknown; address?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  try {
    if (body.action === "challenge") {
      if (!isAddress(body.address)) return json({ error: "address_invalid" }, 400);
      const message = challengeMessage({ origin: ORIGIN, address: body.address, nonce: newNonce(), now: new Date() });
      const { error } = await service.rpc("seeker_wallet_challenge", { p_user: user, p_address: body.address, p_message: message });
      if (error) return json({ error: reason(error.message) }, error.message.startsWith("not_enrolled") ? 403 : 500);
      return json({ message });
    }

    if (body.action === "verify") {
      const signature = base64Bytes(body.signature);
      if (!signature) return json({ error: "signature_invalid" }, 400);
      const { data: pending, error: pendingError } = await service.rpc("seeker_wallet_pending", { p_user: user });
      if (pendingError) return json({ error: reason(pendingError.message) }, 500);
      if (!pending) return json({ error: "challenge_expired" }, 409);
      const { address, message } = pending as { address: string; message: string };
      if (!(await signedBy(address, message, signature))) return json({ error: "signature_invalid" }, 403);

      const { error: verifiedError } = await service.rpc("seeker_wallet_verified", { p_user: user, p_message: message });
      if (verifiedError) return json({ error: reason(verifiedError.message) }, 409);

      // Her payout destination, through the web diary's own check. Before her
      // first reward the program cannot take it yet: the wallet waits.
      const { error: payoutError } = await asCaller.rpc("diary_payout_set", { p_destination: address });
      const payout = !payoutError
        ? "requested"
        : ["no_reward_yet", "payout_in_flight"].includes(reason(payoutError.message))
        ? reason(payoutError.message)
        : "failed";
      if (payout === "failed") console.error("seeker-wallet: diary_payout_set", payoutError?.message);
      return json({ address, payout });
    }

    return json({ error: "bad_request" }, 400);
  } catch (error) {
    console.error("seeker-wallet failed", String(error));
    return json({ error: "unavailable" }, 500);
  }
});
