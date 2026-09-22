// position-mint — the investor's side of a funded loan, as a token she holds.
//
// Called every minute by pg_cron (private.dispatch_position_mint) with the
// anchoring secret in x-anchor-secret. Each claimed position becomes one
// Token-2022 mint of a single indivisible unit, held by the wallet that funded
// it. The borrower's loan is untouched by any of this: she owes instalments in
// reais and this changes nothing about them.
//
// Three things make it controlled rather than merely described:
//
//   DefaultAccountState = Frozen   a token account for this mint is unusable
//                                  the moment it exists, so the asset cannot
//                                  land in a wallet the platform has not
//                                  admitted. The owner's own account is
//                                  thawed in the same transaction, because
//                                  she was admitted before the claim.
//   freeze authority = operator    admission stays revocable.
//   mint authority   = operator    with supply fixed at one; nothing else is
//                                  ever minted for this position.
//
// The mint's key is derived from the operator's key and the position id rather
// than generated, so a retry after a timeout builds the *same* mint address and
// the chain refuses the second creation. A position minted twice by this
// function still exists once on Devnet.
//
// Nothing personal goes on chain: a mint, an amount of one, and a wallet.
//
// Secrets: OPERATOR_KEYPAIR, ANCHOR_CRON_SECRET, optional SOLANA_RPC_URL;
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  type Instruction,
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  AccountState,
  extension,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeDefaultAccountStateInstruction,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
  getThawAccountInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";

interface Claim {
  position_id: string;
  asset_no: number;
  owner_wallet: string;
}

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let operator: KeyPairSigner | undefined;
const getOperator = async () =>
  (operator ??= await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(env("OPERATOR_KEYPAIR")))));

function secretMatches(given: string | null, expected: string): boolean {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * The mint's key, derived rather than generated: the same position always
 * yields the same mint address, which is what makes a retry safe. The
 * operator's own secret is in the derivation, so nobody else can work out a
 * position's mint address before it exists and create the account first.
 */
export async function mintSeed(operatorSecret: Uint8Array, positionId: string): Promise<Uint8Array> {
  const label = new TextEncoder().encode(`EMPOWERFI:POSITION-MINT:v1:${positionId}`);
  const material = new Uint8Array(operatorSecret.length + label.length);
  material.set(operatorSecret, 0);
  material.set(label, operatorSecret.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}

const mintSignerFor = async (positionId: string) =>
  createKeyPairSignerFromPrivateKeyBytes(
    await mintSeed(new Uint8Array(JSON.parse(env("OPERATOR_KEYPAIR"))).slice(0, 32), positionId),
  );

type Status = "confirmed" | "failed" | "unknown";

async function statusOf(signature: string): Promise<{ status: Status; error?: string }> {
  const { value } = await rpc.getSignatureStatuses([signature as never], { searchTransactionHistory: true }).send();
  const s = value[0];
  if (!s) return { status: "unknown" };
  if (s.err) return { status: "failed", error: `transaction failed: ${JSON.stringify(s.err)}` };
  return s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized" ? { status: "confirmed" } : { status: "unknown" };
}

/** The transaction that created a mint, for a mint that already exists. */
async function creationSignature(mint: string): Promise<string | null> {
  const rows = await rpc.getSignaturesForAddress(address(mint), { limit: 100 }).send();
  const landed = rows.filter((r) => !r.err);
  return landed.length ? landed[landed.length - 1].signature : null;
}

async function mintOne(claim: Claim): Promise<{ asset: string; outcome: string; mint?: string; signature?: string; error?: string }> {
  const asset = `EF-CREDIT-${claim.asset_no}`;
  const signer = await getOperator();
  const mint = await mintSignerFor(claim.position_id);
  const owner = address(claim.owner_wallet);
  const [ata] = await findAssociatedTokenPda({
    owner, mint: mint.address, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // Already there? Then this is a retry of something that landed, and the
  // chain — not this function — is the one that knows.
  const existing = await rpc.getAccountInfo(mint.address, { encoding: "base64" }).send();
  if (existing.value) {
    const signature = await creationSignature(mint.address);
    await db.rpc("position_mint_record", {
      p_position_id: claim.position_id, p_mint: mint.address, p_token_account: ata, p_signature: signature,
    });
    return { asset, outcome: "already_minted", mint: mint.address, signature: signature ?? undefined };
  }

  // A mint that carries the frozen-by-default extension, the owner's account,
  // thawed because she is admitted, and the single unit that is her position.
  const space = BigInt(getMintSize([extension("DefaultAccountState", { state: AccountState.Frozen })]));
  const lamports = await rpc.getMinimumBalanceForRentExemption(space).send();
  const instructions: Instruction[] = [
    getCreateAccountInstruction({
      payer: signer, newAccount: mint, lamports, space, programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    }),
    getInitializeDefaultAccountStateInstruction({ mint: mint.address, state: AccountState.Frozen }),
    getInitializeMint2Instruction({
      mint: mint.address, decimals: 0, mintAuthority: signer.address, freezeAuthority: signer.address,
    }),
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer, owner, mint: mint.address, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    }),
    getThawAccountInstruction({ account: ata, mint: mint.address, owner: signer }),
    getMintToInstruction({ mint: mint.address, token: ata, mintAuthority: signer, amount: 1n }),
  ];

  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const transaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    ),
  );
  const signature = getSignatureFromTransaction(transaction);
  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", preflightCommitment: "confirmed" })
    .send();

  for (let i = 0; i < 20; i++) {
    const { status, error } = await statusOf(signature);
    if (status === "confirmed") {
      const { error: recordError } = await db.rpc("position_mint_record", {
        p_position_id: claim.position_id, p_mint: mint.address, p_token_account: ata, p_signature: signature,
      });
      if (recordError) throw new Error(`minted but not recorded: ${recordError.message}`);
      return { asset, outcome: "minted", mint: mint.address, signature };
    }
    if (status === "failed") {
      await db.rpc("position_mint_failed", { p_position_id: claim.position_id, p_error: error ?? "failed" });
      return { asset, outcome: "failed", error };
    }
    await sleep(1_500);
  }
  // Still in flight: leave the claim to lapse. The derived key means the next
  // run finds this mint rather than making a second one.
  return { asset, outcome: "pending", mint: mint.address, signature };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }
  const { data, error } = await db.rpc("position_mint_claim", { p_limit: 5 });
  if (error) return Response.json({ error: `claim failed: ${error.message}` }, { status: 500 });

  const results = [];
  for (const claim of (data ?? []) as Claim[]) {
    try {
      results.push(await mintOne(claim));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.rpc("position_mint_failed", { p_position_id: claim.position_id, p_error: message });
      results.push({ asset: `EF-CREDIT-${claim.asset_no}`, outcome: "error", error: message });
    }
  }
  return Response.json({ claimed: results.length, results });
});
