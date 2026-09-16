// ramp-quote — what MoneyGram Ramps' sandbox would charge to turn USDC into reais.
//
//   POST { "amount_micro_usdc": 100000000 }   with a signed-in session
//
// A USDC cash-out on Solana, priced for Brazil: MoneyGram's fee, its rate and
// what is received. Only the amount and the country go to MoneyGram — no name,
// no wallet, no customer id. Nothing is sent and nothing is recorded: the
// payment simulator shows it next to the demo's own assumptions.
//
// Secrets: MONEYGRAM_BASE_URL and MONEYGRAM_SECRET_KEY (the sandbox's), set on
// the project from the operator's key file; SUPABASE_URL and SUPABASE_ANON_KEY
// from the runtime.

import { createClient } from "@supabase/supabase-js";
import { MONEYGRAM_MAX_MICRO_USDC, MONEYGRAM_MIN_MICRO_USDC, quoteRequest, readQuote } from "../_shared/moneygram.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "not_signed_in" }, 401);

  const base = Deno.env.get("MONEYGRAM_BASE_URL")?.replace(/\/+$/, "");
  const key = Deno.env.get("MONEYGRAM_SECRET_KEY");
  if (!base || !key) return json({ error: "ramp_not_configured" }, 503);

  let amount: unknown;
  try {
    amount = (await req.json())?.amount_micro_usdc;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return json({ error: "invalid_amount" }, 400);
  if (amount < MONEYGRAM_MIN_MICRO_USDC || amount > MONEYGRAM_MAX_MICRO_USDC) {
    return json({ error: "ramp_amount_out_of_range", min_micro_usdc: MONEYGRAM_MIN_MICRO_USDC, max_micro_usdc: MONEYGRAM_MAX_MICRO_USDC }, 422);
  }

  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);

  let res: Response;
  try {
    res = await fetch(`${base}/v1/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(quoteRequest(amount)),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return json({ error: "ramp_unavailable" }, 502);
  }
  const body = await res.json().catch(() => null);
  if (res.status === 422) return json({ error: "ramp_declined", detail: String(body?.message ?? body?.error ?? "").slice(0, 200) }, 422);
  if (!res.ok) {
    console.error("moneygram quote", res.status, JSON.stringify(body)?.slice(0, 300));
    return json({ error: "ramp_unavailable" }, 502);
  }
  try {
    return json({ ...readQuote(body), quoted_at: new Date().toISOString() });
  } catch (e) {
    console.error("moneygram quote unreadable", (e as Error).message);
    return json({ error: "ramp_unavailable" }, 502);
  }
});
