use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
    },
};

use crate::{constants::*, error::AuditError, state::*};

/// SPL Token, the program Circle's USDC lives under.
pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
/// SPL Token's `TransferChecked` instruction tag.
const TRANSFER_CHECKED: u8 = 12;
/// Offset of `decimals` in an SPL mint: COption<Pubkey> (36) | supply (8).
const MINT_DECIMALS_OFFSET: usize = 44;

/// Moves USDC out of the vault: a refund when a partner declines, capital
/// released for disbursement, a repayment paid out. The reason lives in the
/// database; the chain sees only a token transfer out of the vault, and this
/// instruction takes no borrower, opportunity or allocation account, so it
/// links the transfer to no one.
#[derive(Accounts)]
pub struct VaultTransfer<'info> {
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    /// CHECK: the PDA that owns the vault; it signs the transfer by seeds.
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    /// CHECK: SPL Token debits it only if its owner is `vault_authority`, which
    /// is what makes it the vault.
    #[account(mut)]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: SPL Token checks it is the mint of both token accounts.
    #[account(owner = TOKEN_PROGRAM_ID)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: any token account of the same mint; SPL Token checks the mint.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    /// CHECK: pinned to SPL Token.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<VaultTransfer>, amount: u64) -> Result<()> {
    require!(amount > 0, AuditError::ZeroAmount);
    let a = &ctx.accounts;
    let decimals = *a
        .mint
        .try_borrow_data()?
        .get(MINT_DECIMALS_OFFSET)
        .ok_or(AuditError::NotAMint)?;

    let mut data = Vec::with_capacity(10);
    data.push(TRANSFER_CHECKED);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);
    let ix = Instruction {
        program_id: TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(a.vault.key(), false),
            AccountMeta::new_readonly(a.mint.key(), false),
            AccountMeta::new(a.destination.key(), false),
            AccountMeta::new_readonly(a.vault_authority.key(), true),
        ],
        data,
    };
    invoke_signed(
        &ix,
        &[
            a.vault.to_account_info(),
            a.mint.to_account_info(),
            a.destination.to_account_info(),
            a.vault_authority.to_account_info(),
        ],
        &[&[VAULT_SEED, &[ctx.bumps.vault_authority]]],
    )?;
    Ok(())
}
