// Creates the program's USDC vault on devnet, once: the associated token
// account of Circle's devnet USDC owned by the program's `vault` PDA.
// Idempotent; the operator pays the rent. Investors then deposit with a plain
// token transfer — see platform/supabase/functions/investment-confirm.
//
//   OPERATOR_KEYPAIR_FILE=~/empowerfi-hackathon-keys/operator-keypair.json \
//   SOLANA_RPC_URL=<devnet RPC, optional> npx tsx scripts/platform/create-vault.mts

import { readFileSync } from "node:fs";
import {
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const PROGRAM_ID = address("4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR");

const file = process.env.OPERATOR_KEYPAIR_FILE;
if (!file) throw new Error("set OPERATOR_KEYPAIR_FILE");
const operator = await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(file, "utf8"))));
const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com");

const [authority] = await getProgramDerivedAddress({ programAddress: PROGRAM_ID, seeds: ["vault"] });
const [vault] = await findAssociatedTokenPda({ owner: authority, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
console.log(`vault authority (PDA): ${authority}`);
console.log(`vault (USDC account):  ${vault}`);

const existing = await rpc.getAccountInfo(vault, { encoding: "base64" }).send();
if (existing.value) {
  console.log("already exists");
  process.exit(0);
}
const ix = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: operator, owner: authority, mint: USDC_MINT });
const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
const tx = await signTransactionMessageWithSigners(pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(operator, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  (m) => appendTransactionMessageInstruction(ix, m),
));
await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" }).send();
const signature = getSignatureFromTransaction(tx);
for (let i = 0; i < 30; i++) {
  const { value } = await rpc.getSignatureStatuses([signature]).send();
  if (value[0]?.confirmationStatus === "confirmed" || value[0]?.confirmationStatus === "finalized") break;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`created: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
