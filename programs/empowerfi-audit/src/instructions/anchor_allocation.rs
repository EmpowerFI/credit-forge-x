use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
#[instruction(allocation_ref_hash: [u8; 32])]
pub struct AnchorAllocation<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    #[account(
        init,
        payer = operator,
        space = 8 + AllocationCommitment::INIT_SPACE,
        seeds = [ALLOCATION_SEED, allocation_ref_hash.as_ref()],
        bump,
    )]
    pub allocation: Account<'info, AllocationCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AnchorAllocation>, allocation_ref_hash: [u8; 32], commitment: [u8; 32]) -> Result<()> {
    require!(allocation_ref_hash != [0u8; 32], AuditError::ZeroReference);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);
    let a = &mut ctx.accounts.allocation;
    a.allocation_ref_hash = allocation_ref_hash;
    a.commitment = commitment;
    a.allocated_at = Clock::get()?.unix_timestamp;
    a.schema_version = SCHEMA_VERSION;
    a.bump = ctx.bumps.allocation;
    Ok(())
}
