// investment-confirm — turns a devnet USDC deposit into an allocation.
//
//   POST { "opportunity_id": "<uuid>", "signature": "<base58>" }   with the investor's session
//
// The investor's wallet sends USDC to the program's vault with a plain token
// transfer and hands us the signature. Nothing is taken on trust: the
// transaction is read from chain, and it must have succeeded and moved Circle
// devnet USDC from an account the investor's own wallet controls into the
// vault. The amount on chain is what gets allocated. The same signature
// twice is recorded once.
//
// Secrets: optional SOLANA_RPC_URL; SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import { type Address, address, createSolanaRpc, getProgramDerivedAddress, type Signature } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

/** Circle's USDC on Solana devnet. */
export const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const PROGRAM_ID = address("4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR");

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
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function vaultAccount(): Promise<Address> {
  const [authority] = await getProgramDerivedAddress({ programAddress: PROGRAM_ID, seeds: ["vault"] });
  const [ata] = await findAssociatedTokenPda({ owner: authority, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

interface ParsedIx {
  program?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
}

/** The USDC this transaction moved from the wallet into the vault, in micro-USDC. */
async function depositOf(signature: string, wallet: string): Promise<bigint> {
  let tx = null;
  for (let i = 0; i < 8 && !tx; i++) {
    tx = await rpc.getTransaction(signature as Signature, {
      encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed",
    }).send();
    if (!tx) await sleep(1500);
  }
  if (!tx) throw new Error("transaction_not_found");
  if (tx.meta?.err) throw new Error("transaction_failed");

  const vault = await vaultAccount();
  const outer = (tx.transaction.message.instructions ?? []) as unknown as ParsedIx[];
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((g) => g.instructions as unknown as ParsedIx[]);
  let total = 0n;
  for (const ix of [...outer, ...inner]) {
    if (ix.program !== "spl-token" || !ix.parsed?.info) continue;
    const { type, info } = ix.parsed;
    if (info.destination !== vault || info.authority !== wallet) continue;
    if (type === "transferChecked" && info.mint === USDC_MINT) {
      total += BigInt((info.tokenAmount as { amount: string }).amount);
    } else if (type === "transfer") {
      // The vault's account only ever holds USDC: the destination is the mint check.
      total += BigInt(info.amount as string);
    }
  }
  if (total === 0n) throw new Error("no_usdc_deposit_to_vault");
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "not_signed_in" }, 401);

  let body: { opportunity_id?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const { opportunity_id: opportunityId, signature } = body;
  if (typeof opportunityId !== "string" || !UUID.test(opportunityId)) return json({ error: "invalid_opportunity_id" }, 400);
  if (typeof signature !== "string" || !BASE58.test(signature)) return json({ error: "invalid_signature" }, 400);

  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_signed_in" }, 401);

  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: profile } = await service.from("profiles").select("role, wallet_address").eq("id", who.user.id).single();
  if (profile?.role !== "capital_provider" || !profile.wallet_address) return json({ error: "not_a_wallet_investor" }, 403);

  let amount: bigint;
  try {
    amount = await depositOf(signature, profile.wallet_address);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, message === "transaction_not_found" ? 404 : 422);
  }

  const { data, error } = await service.rpc("record_investment", {
    p_investor_id: who.user.id,
    p_opportunity_id: opportunityId,
    p_amount_micro_usdc: Number(amount),
    p_mode: "wallet",
    p_wallet_address: profile.wallet_address,
    p_deposit_signature: signature,
  });
  if (error) {
    const status = error.message === "exceeds_remaining" || error.message === "opportunity_not_open" ? 409 : 500;
    return json({ error: error.message }, status);
  }
  return json({ ...(data as object), amount_micro_usdc: Number(amount) });
});
