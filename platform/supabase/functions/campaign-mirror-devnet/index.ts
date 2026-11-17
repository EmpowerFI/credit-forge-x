// campaign-mirror-devnet — mirrors a REAL campaign of the dashboard in a vault
// on Solana devnet (programs/empowerfi-rewards), funded by EmpowerFI's operator
// with test USDC (migration 20270109000000).
//
// Called from empowerfi-dashboard by someone who manages campaigns, with her
// session. The database decides what goes on chain (campaign_mirror_plan,
// which also refuses anyone else): the campaign's own id, its days, at least
// 100 seats, and a price per seat whose entrepreneurs' half is the campaign's
// reward per woman at the chosen rate of test USDC per R$ 1.
//
//   { program_id, units_per_brl, action: "quote" }   what it costs, and what the operator holds
//   { program_id, units_per_brl, action: "create" }  one transaction: create_campaign,
//                                                     the vault, fund_campaign; then it is
//                                                     read back from the chain and recorded
//
// The operator is the sponsor on chain. A run that died after the transaction
// landed is finished by the next "create": the account is found funded by the
// operator, checked, and recorded. Real rewards stay paid by hand, in reais.
//
// Secrets: CAMPAIGN_OPERATOR_KEYPAIR, CAMPAIGN_OPERATOR_AUTHORITY (campaign-attest's);
// optional SOLANA_RPC_URL. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are the platform's own.

import { createClient } from "@supabase/supabase-js";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  type Instruction,
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Signature,
} from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  campaignWindow, checkCampaign, createCampaignData, decodeCampaign, fundCampaignData, HOUSE_WALLET, OPERATOR_WALLET,
  REWARDS_PROGRAM_ID, type Terms, termsCommitment, USDC_DECIMALS, USDC_DEVNET_MINT, uuidBytes,
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
const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

/** What campaign_mirror_plan answers. */
interface Plan {
  program_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  seats: number | null;
  seats_on_chain: number;
  reward_cents: number;
  units_per_brl: number;
  price_per_seat_units: string;
  funded_units: string;
  mint_decimals: number;
}

/** The database's refusals the dashboard can explain. */
const PLAN_ERRORS = [
  "no_such_campaign", "house_campaign_is_fixed", "campaign_is_devnet", "already_on_chain", "campaign_has_no_reward",
  "campaign_shorter_than_30_days", "campaign_over", "rate_invalid", "price_below_minimum",
];

let signer: KeyPairSigner | undefined;
async function operator(): Promise<KeyPairSigner> {
  if (!signer) {
    signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(env("CAMPAIGN_OPERATOR_KEYPAIR"))));
    if (signer.address !== env("CAMPAIGN_OPERATOR_AUTHORITY")) {
      throw new Error("CAMPAIGN_OPERATOR_KEYPAIR is not the key CAMPAIGN_OPERATOR_AUTHORITY publishes");
    }
    // The vault's terms name this operator (checkCampaign): any other key would make a vault no one records.
    if (signer.address !== OPERATOR_WALLET) throw new Error("the operator key is not the campaigns' operator");
  }
  return signer;
}

async function balances(owner: string, tokens: string) {
  const lamports = (await rpc.getBalance(address(owner), { commitment: "confirmed" }).send()).value;
  let usdc = 0n;
  try {
    usdc = BigInt((await rpc.getTokenAccountBalance(address(tokens), { commitment: "confirmed" }).send()).value.amount);
  } catch {
    // No token account yet: nothing held.
  }
  return { lamports: lamports.toString(), usdc_units: usdc.toString() };
}

async function confirm(signature: Signature, lastValid: bigint): Promise<"confirmed" | "failed" | "expired"> {
  for (let i = 0; i < 30; i++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
    if (status?.err) return "failed";
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return "confirmed";
    if (!status && (await rpc.getBlockHeight({ commitment: "confirmed" }).send()) > lastValid) return "expired";
    await sleep(2_000);
  }
  return "expired";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "forbidden" }, 403);

  let body: { program_id?: string; units_per_brl?: number; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const { program_id: id = "", units_per_brl: rate, action = "quote" } = body;
  if (!UUID.test(id) || typeof rate !== "number" || !["quote", "create"].includes(action)) return json({ error: "bad_request" }, 400);

  try {
    // As the caller: the database refuses anyone who does not manage campaigns.
    const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: user } = await asCaller.auth.getUser(token);
    if (!user.user) return json({ error: "forbidden" }, 403);
    const { data: planned, error: planError } = await asCaller.rpc("campaign_mirror_plan", { p_program_id: id, p_units_per_brl: rate });
    if (planError) {
      if (planError.code === "42501") return json({ error: "forbidden" }, 403);
      const known = PLAN_ERRORS.find((k) => planError.message.includes(k));
      if (known) return json({ error: known }, 409);
      throw new Error(planError.message);
    }
    const plan = planned as Plan;

    const key = await operator();
    const program = address(REWARDS_PROGRAM_ID);
    const mint = address(USDC_DEVNET_MINT);
    const [campaign] = await getProgramDerivedAddress({ programAddress: program, seeds: [new TextEncoder().encode("campaign"), uuidBytes(id)] });
    const [vault] = await findAssociatedTokenPda({ owner: campaign, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const [operatorTokens] = await findAssociatedTokenPda({ owner: key.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const funded = BigInt(plan.funded_units);
    const price = BigInt(plan.price_per_seat_units);
    const held = await balances(key.address, operatorTokens);
    const terms: Terms = { campaign: id, seats: plan.seats_on_chain, pricePerSeatUnits: price, startsOn: plan.starts_on, endsOn: plan.ends_on };

    if (action === "quote") {
      return json({ plan, operator: key.address, operator_tokens: operatorTokens, campaign_address: campaign, vault_address: vault, ...held });
    }

    // What is on chain already, if a run died after sending.
    const readAccount = async () => {
      const info = await rpc.getAccountInfo(campaign, { encoding: "base64", commitment: "confirmed" }).send();
      if (!info.value) return null;
      if (info.value.owner !== REWARDS_PROGRAM_ID) throw new Error("the campaign address is not the program's");
      return decodeCampaign(Uint8Array.from(atob(info.value.data[0]), (c) => c.charCodeAt(0)));
    };
    const window = campaignWindow(plan.starts_on, plan.ends_on);
    const committed = hex(await termsCommitment(terms));
    const onPlan = (a: NonNullable<Awaited<ReturnType<typeof readAccount>>>) =>
      a.sponsor === key.address && a.seats === plan.seats_on_chain && a.pricePerSeat === price
      && a.startsAt === window.startsAt && a.endsAt === window.endsAt && a.termsCommitment === committed;
    let onChain = await readAccount();
    if (onChain && onChain.sponsor !== key.address) return json({ error: "campaign_address_taken" }, 409);
    // Made by an earlier run at another rate: it can only be recorded at that rate.
    if (onChain && !onPlan(onChain)) return json({ error: "on_chain_at_another_rate" }, 409);

    if (!onChain || onChain.status !== "funded") {
      if (BigInt(held.usdc_units) < funded) {
        return json({ error: "operator_needs_usdc", needed_units: funded.toString(), held_units: held.usdc_units, operator: key.address }, 422);
      }
      if (held.lamports === "0") return json({ error: "operator_needs_sol", operator: key.address }, 422);
      const instructions: Instruction[] = [];
      if (!onChain) {
        instructions.push({
          programAddress: program,
          accounts: [
            { address: key.address, role: AccountRole.WRITABLE_SIGNER, signer: key } as never,
            { address: address(OPERATOR_WALLET), role: AccountRole.READONLY },
            { address: address(HOUSE_WALLET), role: AccountRole.READONLY },
            { address: mint, role: AccountRole.READONLY },
            { address: campaign, role: AccountRole.WRITABLE },
            { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
          ],
          data: await createCampaignData(terms),
        });
      }
      instructions.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: key, owner: campaign, mint }));
      instructions.push({
        programAddress: program,
        accounts: [
          { address: key.address, role: AccountRole.READONLY_SIGNER, signer: key } as never,
          { address: campaign, role: AccountRole.WRITABLE },
          { address: mint, role: AccountRole.READONLY },
          { address: operatorTokens, role: AccountRole.WRITABLE },
          { address: vault, role: AccountRole.WRITABLE },
          { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        ],
        data: await fundCampaignData(),
      });
      const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      const transaction = await signTransactionMessageWithSigners(
        pipe(
          createTransactionMessage({ version: 0 }),
          (m) => setTransactionMessageFeePayerSigner(key, m),
          (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
          (m) => appendTransactionMessageInstructions(instructions, m),
        ),
      );
      const signature = getSignatureFromTransaction(transaction);
      await rpc.sendTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", preflightCommitment: "confirmed" }).send();
      const outcome = await confirm(signature, blockhash.lastValidBlockHeight);
      if (outcome !== "confirmed") return json({ error: `transaction_${outcome}`, signature }, 502);
      onChain = await readAccount();
    }

    // Read back: on the plan's terms, funded in full, the vault holding it.
    if (!onChain) return json({ error: "campaign_not_found" }, 502);
    const refused = checkCampaign(onChain, id);
    // A real campaign may run longer than 30 days; the program allows it, Missions does not.
    if (refused && refused !== "not a 30-day campaign") return json({ error: "terms_refused", detail: refused }, 422);
    if (!onPlan(onChain)) return json({ error: "terms_refused", detail: "not the plan's terms" }, 422);
    const inVault = await rpc.getTokenAccountBalance(address(onChain.vault), { commitment: "confirmed" }).send();
    if (BigInt(inVault.value.amount) < onChain.funded) return json({ error: "terms_refused", detail: "vault does not hold the funds" }, 422);

    // Oldest signature on the account created it; the funding one is the latest before anything else touched it.
    const history = await rpc.getSignaturesForAddress(campaign, { limit: 20, commitment: "confirmed" }).send();
    const created = history[history.length - 1]?.signature ?? "";
    const fundedSig = history.find((h) => !h.err)?.signature ?? created;

    const { data, error } = await service.rpc("campaign_mirror_record", {
      p: {
        program_id: id, seats: onChain.seats, price_per_seat_units: onChain.pricePerSeat.toString(), mint_decimals: USDC_DECIMALS,
        program_address: REWARDS_PROGRAM_ID, campaign_address: campaign, vault_address: onChain.vault, mint: onChain.mint,
        sponsor_wallet: onChain.sponsor, house_wallet: onChain.house, operator_wallet: onChain.operator,
        terms_commitment: onChain.termsCommitment, created_signature: created, funded_signature: fundedSig,
        funded_units: onChain.funded.toString(), funded_at: new Date(onChain.fundedAt * 1000).toISOString(),
        by: user.user.id, units_per_brl: rate,
      },
    });
    if (error) {
      if (error.message.includes("already_on_chain")) return json({ error: "already_on_chain" }, 409);
      throw new Error(error.message);
    }
    return json({ ...(data as object), campaign_address: campaign, vault_address: onChain.vault, signature: fundedSig });
  } catch (error) {
    console.error("campaign-mirror-devnet failed", String(error));
    return json({ error: "server_error" }, 500);
  }
});
