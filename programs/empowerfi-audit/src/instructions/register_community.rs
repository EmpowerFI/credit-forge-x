use anchor_lang::prelude::*;

use crate::{
    constants::{COMMUNITY_SEED, CONFIG_SEED, SCHEMA_VERSION},
    error::AuditError,
    state::{CommunityAudit, CommunityStatus, PlatformConfig},
};

#[derive(Accounts)]
#[instruction(community_ref: [u8; 32])]
pub struct RegisterCommunity<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = operator @ AuditError::UnauthorizedOperator,
    )]
    pub config: Account<'info, PlatformConfig>,

    // Registering the same community twice fails here, at init: the PDA seed is
    // the idempotency key.
    #[account(
        init,
        payer = operator,
        space = 8 + CommunityAudit::INIT_SPACE,
        seeds = [COMMUNITY_SEED, community_ref.as_ref()],
        bump,
    )]
    pub community: Account<'info, CommunityAudit>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterCommunity>,
    community_ref: [u8; 32],
    commitment: [u8; 32],
) -> Result<()> {
    require!(community_ref != [0u8; 32], AuditError::ZeroReference);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);

    let community = &mut ctx.accounts.community;
    community.community_ref = community_ref;
    community.commitment = commitment;
    community.status = CommunityStatus::Registered;
    community.verification_commitment = [0u8; 32];
    community.registered_at = Clock::get()?.unix_timestamp;
    community.verified_at = 0;
    community.schema_version = SCHEMA_VERSION;
    community.bump = ctx.bumps.community;
    Ok(())
}
