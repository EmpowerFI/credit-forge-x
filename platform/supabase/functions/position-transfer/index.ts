// position-transfer — admitting a destination, and recording what she signed.
//
// The investor moves her own position: she builds the transfer in her browser
// and signs it with her own wallet. This function never touches her asset and
// could not move it if it wanted to. What it holds is the freeze authority,
// which is a veto over where the asset may go rather than a power to send it.
//
//   prepare   the destination's token account is created and thawed, by the
//             operator, because that wallet is on eligible_wallets. Until this
//             has happened the account is frozen and her transfer would fail
//             at the token program — which is the control working, not a bug.
//   record    the signature she got back is checked against the chain: the
//             asset has to be in the destination and gone from the source
//             before this platform writes down that it moved.
//
// Both actions need her to be signed in, and `position_transfer_check` runs as
// her, so a caller cannot prepare or record a transfer of someone else's.
//
// Secrets: OPERATOR_KEYPAIR, optional SOLANA_RPC_URL; SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
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
import {
  AccountState,
  fetchMaybeToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getThawAccountInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

const rpc = createSolanaRpc(Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com");
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let operator: KeyPairSigner | undefined;
const getOperator = async () =>
  (operator ??= await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(env("OPERATOR_KEYPAIR")))));

interface Checked {
  position_id: string;
  asset: string;
  mint_address: string;
  from_wallet: string;
  from_token_account: string | null;
  to_wallet: string;
}

const ataFor = async (owner: string, mint: string) => {
  const [ata] = await findAssociatedTokenPda({
    owner: address(owner), mint: address(mint), tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  return ata;
};

/** Amount held, and whether the account can be used at all. */
async function tokenAccount(account: Awaited<ReturnType<typeof ataFor>>) {
  const maybe = await fetchMaybeToken(rpc, account);
  if (!maybe.exists) return { exists: false as const };
  return { exists: true as const, amount: maybe.data.amount, frozen: maybe.data.state === AccountState.Frozen };
}

/** Creates the destination's account if it has none, and thaws it if frozen. */
async function admit(c: Checked): Promise<{ destination: string; signature: string | null; already: boolean }> {
  const signer = await getOperator();
  const destination = await ataFor(c.to_wallet, c.mint_address);
  const state = await tokenAccount(destination);
  if (state.exists && !state.frozen) return { destination, signature: null, already: true };

  const instructions: Instruction[] = [];
  if (!state.exists) {
    instructions.push(await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer, owner: address(c.to_wallet), mint: address(c.mint_address), tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    }));
  }
  instructions.push(getThawAccountInstruction({ account: destination, mint: address(c.mint_address), owner: signer }));

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
    const { value } = await rpc.getSignatureStatuses([signature as never], { searchTransactionHistory: true }).send();
    const s = value[0];
    if (s?.err) throw new Error(`could not admit the destination: ${JSON.stringify(s.err)}`);
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
      return { destination, signature, already: false };
    }
    await sleep(1_500);
  }
  throw new Error("admitting the destination did not confirm");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);
  const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who.user) return json({ error: "unauthorized" }, 401);

  let body: { action?: string; position_id?: string; to_wallet?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!body.position_id || !body.to_wallet) return json({ error: "bad_request" }, 400);

  // Run as her: ownership, admission and the state of the position are all
  // decided by the database, not by this function.
  const { data, error } = await asCaller.rpc("position_transfer_check", {
    p_position_id: body.position_id, p_to_wallet: body.to_wallet,
  });
  if (error) return json({ error: error.message }, 400);
  const checked = data as unknown as Checked;

  try {
    if (body.action === "prepare") {
      const { destination, signature, already } = await admit(checked);
      return json({
        asset: checked.asset,
        mint: checked.mint_address,
        source: await ataFor(checked.from_wallet, checked.mint_address),
        destination,
        decimals: 0,
        admitted: already ? "already" : "now",
        admission_signature: signature,
      });
    }

    if (body.action === "record") {
      if (!body.signature) return json({ error: "no_signature" }, 400);
      const source = await ataFor(checked.from_wallet, checked.mint_address);
      const destination = await ataFor(checked.to_wallet, checked.mint_address);
      // The chain, not the caller, says whether it happened.
      const { value } = await rpc.getSignatureStatuses([body.signature as never], { searchTransactionHistory: true }).send();
      const s = value[0];
      if (!s) return json({ error: "signature_not_found" }, 409);
      if (s.err) return json({ error: `transfer failed: ${JSON.stringify(s.err)}` }, 409);
      const [before, after] = await Promise.all([tokenAccount(source), tokenAccount(destination)]);
      if (!after.exists || after.amount !== 1n || (before.exists && before.amount !== 0n)) {
        return json({ error: "the asset is not where the transfer says it is" }, 409);
      }
      const { error: recordError } = await admin.rpc("position_transferred", {
        p_position_id: checked.position_id,
        p_from: checked.from_wallet,
        p_to: checked.to_wallet,
        p_token_account: destination,
        p_signature: body.signature,
      });
      if (recordError) return json({ error: recordError.message }, 500);
      return json({ asset: checked.asset, owner: checked.to_wallet, signature: body.signature });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
