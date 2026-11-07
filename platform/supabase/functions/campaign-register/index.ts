// campaign-register — records a campaign a sponsor created and funded from its
// own wallet on /app/missions, once the chain confirms it.
//
// Open to anyone (the page has no sign-in), so it trusts nothing it is sent
// but the signature and the campaign's id: everything recorded is read back
// from Solana devnet. The transaction must have landed and touched the
// campaign's account; the account must be the program's, funded in full, on
// EmpowerFI's terms (its operator, its half, devnet USDC, at least 100 seats,
// 30 days); its terms commitment must be the one the database will show; the
// vault must hold the money. The campaign is then written unlisted
// (campaign_register): no one sees the names a wallet typed until EmpowerFI
// reviews them.
//
// Secrets: none of its own; optional SOLANA_RPC_URL.

import { createClient } from "@supabase/supabase-js";
import { address, createSolanaRpc, getProgramDerivedAddress, type Signature } from "@solana/kit";
import {
  checkCampaign, decodeCampaign, REWARDS_PROGRAM_ID, spDay, termsCommitment, USDC_DECIMALS, uuidBytes,
} from "../_shared/campaign-vault/index.ts";

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
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: { signature?: string; program_id?: string; name?: string; sponsor_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const { signature = "", program_id: id = "", name = "", sponsor_name: sponsorName = "" } = body;
  if (!SIGNATURE.test(signature) || !UUID.test(id)) return json({ error: "bad_request" }, 400);

  try {
    const [campaign] = await getProgramDerivedAddress({
      programAddress: address(REWARDS_PROGRAM_ID),
      seeds: [new TextEncoder().encode("campaign"), uuidBytes(id)],
    });

    // The transaction: landed, succeeded, and about this campaign.
    const tx = await rpc.getTransaction(signature as Signature, {
      commitment: "confirmed", maxSupportedTransactionVersion: 0, encoding: "json",
    }).send();
    if (!tx) return json({ error: "transaction_not_found" }, 404);
    if (tx.meta?.err) return json({ error: "transaction_failed" }, 422);
    const keys = tx.transaction.message.accountKeys.map(String);
    if (!keys.includes(campaign)) return json({ error: "transaction_is_not_this_campaign" }, 422);

    // The account: the program's, on EmpowerFI's terms.
    const info = await rpc.getAccountInfo(campaign, { encoding: "base64", commitment: "confirmed" }).send();
    if (!info.value || info.value.owner !== REWARDS_PROGRAM_ID) return json({ error: "campaign_not_found" }, 404);
    const a = decodeCampaign(Uint8Array.from(atob(info.value.data[0]), (c) => c.charCodeAt(0)));
    const refused = checkCampaign(a, id);
    if (refused) return json({ error: "terms_refused", detail: refused }, 422);

    const startsOn = spDay(a.startsAt);
    const endsOn = spDay(a.endsAt - 1);
    const committed = hex(await termsCommitment({ campaign: id, seats: a.seats, pricePerSeatUnits: a.pricePerSeat, startsOn, endsOn }));
    if (committed !== a.termsCommitment) return json({ error: "terms_refused", detail: "terms commitment" }, 422);

    const balance = await rpc.getTokenAccountBalance(address(a.vault), { commitment: "confirmed" }).send();
    if (BigInt(balance.value.amount) < a.funded) return json({ error: "terms_refused", detail: "vault does not hold the funds" }, 422);

    const { data, error } = await db.rpc("campaign_register", {
      p: {
        program_id: id, name, sponsor_name: sponsorName, period_start: startsOn, period_end: endsOn,
        seats: a.seats, price_per_seat_units: a.pricePerSeat.toString(), mint_decimals: USDC_DECIMALS,
        program_address: REWARDS_PROGRAM_ID, campaign_address: campaign, vault_address: a.vault, mint: a.mint,
        sponsor_wallet: a.sponsor, house_wallet: a.house, operator_wallet: a.operator,
        terms_commitment: a.termsCommitment, signature, funded_units: a.funded.toString(),
        funded_at: new Date((tx.blockTime ? Number(tx.blockTime) : a.fundedAt) * 1000).toISOString(),
      },
    });
    if (error) {
      const known = ["campaign_name_length", "sponsor_name_length", "sponsor_name_taken", "campaign_name_taken"]
        .find((k) => error.message.includes(k));
      if (known) return json({ error: known }, 409);
      throw new Error(error.message);
    }
    return json(data);
  } catch (error) {
    console.error("campaign-register failed", String(error));
    return json({ error: "server_error" }, 500);
  }
});
