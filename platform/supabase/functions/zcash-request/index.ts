// zcash-request — a ZIP 321 payment request to fund an opportunity with shielded ZEC.
//
//   POST { "opportunity_id": "<uuid>", "amount_micro_usdc": 10000000 }   with the investor's session
//
// The amount is priced at CoinGecko's ZEC/USD quote when it answers within a
// few seconds, and at a labelled demo quote otherwise. Testnet ZEC has no
// value: the quote only makes the amounts look like the real thing. The
// request, its reference and the treasury's address come from the database;
// the payment URI is built here (ZIP 321: amount in ZEC, memo base64url).
//
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import { paymentUri } from "../_shared/zcash.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Used when CoinGecko does not answer; shown as a demo quote. */
const DEMO_USD_PER_ZEC_CENTS = 100_000;

async function quote(): Promise<{ cents: number; source: "coingecko" | "demo" }> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd", {
      signal: AbortSignal.timeout(4000),
    });
    const usd = (await res.json())?.zcash?.usd;
    if (res.ok && typeof usd === "number" && usd > 0) return { cents: Math.round(usd * 100), source: "coingecko" };
  } catch {
    // fall through to the demo quote
  }
  return { cents: DEMO_USD_PER_ZEC_CENTS, source: "demo" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "not_signed_in" }, 401);

  let body: { opportunity_id?: unknown; amount_micro_usdc?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const { opportunity_id: opportunityId, amount_micro_usdc: amount } = body;
  if (typeof opportunityId !== "string" || !UUID.test(opportunityId)) return json({ error: "invalid_opportunity_id" }, 400);
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return json({ error: "invalid_amount" }, 400);

  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);

  const q = await quote();
  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data, error } = await service.rpc("create_zcash_request", {
    p_investor_id: who.user.id,
    p_opportunity_id: opportunityId,
    p_amount_micro_usdc: amount,
    p_usd_per_zec_cents: q.cents,
    p_quote_source: q.source,
  });
  if (error) {
    const code = error.code ?? "";
    const status = code === "42501" ? 403 : code === "P0002" ? 404 : code === "22023" || code === "P0001" ? 409 : 500;
    return json({ error: error.message }, status);
  }
  const r = data as { address: string; amount_zat: number; memo: string; ref: string };
  return json({ ...r, uri: paymentUri(r.address, r.amount_zat, r.memo, `EmpowerFI ${r.ref}`) });
});
