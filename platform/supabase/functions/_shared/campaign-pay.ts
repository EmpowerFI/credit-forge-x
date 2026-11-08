// Paying a woman who kept the days, into her reward wallet
// (programs/empowerfi-rewards, pay_reward). Apart from campaign.ts because
// @solana/kit wants more of the runtime than the shared tests grant.

import {
  AccountRole,
  address,
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Instruction,
  type TransactionSigner,
} from "npm:@solana/kit@8.3.0";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "npm:@solana-program/token@0.16.1";
import { payRewardData, RECEIPT_SEED, RECIPIENT_SEED, REWARDS_PROGRAM_ID, uuidBytes } from "./campaign-vault/index.ts";
import { hex, inclusionProof, leafHash, unhex } from "./passport/index.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Her reward wallet: the program's address at [recipient, her wallet ref]. No key exists for it. */
export async function walletOf(ref: string, program: string = REWARDS_PROGRAM_ID): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({ programAddress: address(program), seeds: [utf8(RECIPIENT_SEED), uuidBytes(ref)] });
  return pda;
}

/** What campaign_payment_due gives: the woman to pay and the campaign's accounts. */
export interface RewardDue {
  program_address: string;
  campaign_address: string;
  vault_address: string;
  mint: string;
  wallet_ref: string;
  salt: string;
  index: number;
  leaves: string[];
}

/**
 * The two instructions of a payment: her wallet's token account, created if
 * missing (the operator pays the rent), then pay_reward with her leaf's
 * inclusion proof in the attested tree.
 */
export async function payRewardInstructions(operator: TransactionSigner, due: RewardDue): Promise<[Instruction, Instruction]> {
  const program = address(due.program_address);
  const wallet = await walletOf(due.wallet_ref, due.program_address);
  const mint = address(due.mint);
  const [tokens] = await findAssociatedTokenPda({ owner: wallet, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const [receipt] = await getProgramDerivedAddress({
    programAddress: program,
    seeds: [utf8(RECEIPT_SEED), getAddressEncoder().encode(address(due.campaign_address)), uuidBytes(due.wallet_ref)],
  });
  const hashed = await Promise.all(due.leaves.map((l) => leafHash(unhex(l))));
  const proof = (await inclusionProof(hashed, due.index)).map(hex);
  const createTokens = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: operator, owner: wallet, mint });
  const pay: Instruction = {
    programAddress: program,
    accounts: [
      { address: operator.address, role: AccountRole.WRITABLE_SIGNER, signer: operator } as never,
      { address: address(due.campaign_address), role: AccountRole.READONLY },
      { address: mint, role: AccountRole.READONLY },
      { address: address(due.vault_address), role: AccountRole.WRITABLE },
      { address: wallet, role: AccountRole.READONLY },
      { address: tokens, role: AccountRole.WRITABLE },
      { address: receipt, role: AccountRole.WRITABLE },
      { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: address("11111111111111111111111111111111"), role: AccountRole.READONLY },
    ],
    data: await payRewardData(due.wallet_ref, due.salt, due.index, proof),
  };
  return [createTokens, pay];
}
