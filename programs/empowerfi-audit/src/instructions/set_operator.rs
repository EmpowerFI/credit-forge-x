use anchor_lang::prelude::*;

use crate::{constants::CONFIG_SEED, error::AuditError, state::PlatformConfig};

/// Rotates the operator key, for when the server-side key has to be replaced.
#[derive(Accounts)]
pub struct SetOperator<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ AuditError::UnauthorizedAuthority,
    )]
    pub config: Account<'info, PlatformConfig>,
}

pub fn handler(ctx: Context<SetOperator>, operator: Pubkey) -> Result<()> {
    ctx.accounts.config.operator = operator;
    Ok(())
}
