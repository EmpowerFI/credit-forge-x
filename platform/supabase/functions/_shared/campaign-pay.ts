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
  type ReadonlyUint8Array,
  type TransactionSigner,
} from "npm:@solana/kit@8.3.0";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "npm:@solana-program/token@0.16.1";
import {
  HOUSE_LEDGER_SEED,
  PAYOUT_SEED,
  payRewardData,
  RECEIPT_SEED,
  RECIPIENT_SEED,
  REWARDS_PROGRAM_ID,
  setPayoutData,
  uuidBytes,
  withdrawHouseData,
  withdrawRewardData,
} from "./campaign-vault/index.ts";
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
      { address: await houseLedgerOf(due.campaign_address, due.program_address), role: AccountRole.READONLY },
    ],
    data: await payRewardData(due.wallet_ref, due.salt, due.index, proof),
  };
  return [createTokens, pay];
}

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

async function pda(program: string, seeds: (Uint8Array | ReadonlyUint8Array)[]): Promise<Address> {
  const [a] = await getProgramDerivedAddress({ programAddress: address(program), seeds });
  return a;
}

const receiptOf = (program: string, campaign: string, ref: string) =>
  pda(program, [utf8(RECEIPT_SEED), getAddressEncoder().encode(address(campaign)), uuidBytes(ref)]);
const payoutOf = (program: string, ref: string) => pda(program, [utf8(PAYOUT_SEED), uuidBytes(ref)]);
/** What EmpowerFI has taken of a campaign's half (empty until it first does). */
export const houseLedgerOf = (campaign: string, program: string = REWARDS_PROGRAM_ID) =>
  pda(program, [utf8(HOUSE_LEDGER_SEED), getAddressEncoder().encode(address(campaign))]);

/** What payout_op_next gives: the operation and the campaign its transaction goes through. */
export interface PayoutPlan {
  kind: "set_payout" | "withdraw_reward" | "withdraw_house";
  destination: string;
  wallet_ref: string | null;
  program_address: string;
  campaign_address: string;
  vault_address: string;
  mint: string;
  house_wallet: string;
}

/** The token account a wallet holds the mint in. */
export async function tokensOf(owner: string, mint: string): Promise<Address> {
  const [t] = await findAssociatedTokenPda({ owner: address(owner), mint: address(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return t;
}

/** set_payout: where her wallet pays out from a day after. */
export async function setPayoutInstructions(operator: TransactionSigner, p: PayoutPlan): Promise<Instruction[]> {
  const ref = p.wallet_ref!;
  return [{
    programAddress: address(p.program_address),
    accounts: [
      { address: operator.address, role: AccountRole.WRITABLE_SIGNER, signer: operator } as never,
      { address: address(p.campaign_address), role: AccountRole.READONLY },
      { address: await receiptOf(p.program_address, p.campaign_address, ref), role: AccountRole.READONLY },
      { address: await walletOf(ref, p.program_address), role: AccountRole.READONLY },
      { address: await payoutOf(p.program_address, ref), role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: await setPayoutData(ref, Uint8Array.from(getAddressEncoder().encode(address(p.destination)))),
  }];
}

/** withdraw_reward: the destination's token account, created if missing, then everything her wallet holds. */
export async function withdrawRewardInstructions(operator: TransactionSigner, p: PayoutPlan): Promise<Instruction[]> {
  const ref = p.wallet_ref!;
  const wallet = await walletOf(ref, p.program_address);
  const mint = address(p.mint);
  const createTokens = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: operator, owner: address(p.destination), mint });
  return [createTokens, {
    programAddress: address(p.program_address),
    accounts: [
      { address: operator.address, role: AccountRole.WRITABLE_SIGNER, signer: operator } as never,
      { address: address(p.campaign_address), role: AccountRole.READONLY },
      { address: await receiptOf(p.program_address, p.campaign_address, ref), role: AccountRole.READONLY },
      { address: mint, role: AccountRole.READONLY },
      { address: wallet, role: AccountRole.READONLY },
      { address: await tokensOf(wallet, p.mint), role: AccountRole.WRITABLE },
      { address: await payoutOf(p.program_address, ref), role: AccountRole.READONLY },
      { address: await tokensOf(p.destination, p.mint), role: AccountRole.WRITABLE },
      { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: await withdrawRewardData(ref),
  }];
}

/** withdraw_house: the house's token account, created if missing, then what is left of EmpowerFI's half. */
export async function withdrawHouseInstructions(operator: TransactionSigner, p: PayoutPlan): Promise<Instruction[]> {
  const mint = address(p.mint);
  const createTokens = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: operator, owner: address(p.house_wallet), mint });
  return [createTokens, {
    programAddress: address(p.program_address),
    accounts: [
      { address: operator.address, role: AccountRole.WRITABLE_SIGNER, signer: operator } as never,
      { address: address(p.campaign_address), role: AccountRole.READONLY },
      { address: mint, role: AccountRole.READONLY },
      { address: address(p.vault_address), role: AccountRole.WRITABLE },
      { address: await tokensOf(p.house_wallet, p.mint), role: AccountRole.WRITABLE },
      { address: await houseLedgerOf(p.campaign_address, p.program_address), role: AccountRole.WRITABLE },
      { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: await withdrawHouseData(),
  }];
}
