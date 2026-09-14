use anchor_lang::prelude::*;

use crate::{
    constants::{COMMUNITY_SEED, CONFIG_SEED},
    error::AuditError,
    state::{CommunityAudit, CommunityStatus, PlatformConfig},
};

#[derive(Accounts)]
pub struct VerifyCommunity<'info> {
    pub operator: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = operator @ AuditError::UnauthorizedOperator,
    )]
    pub config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        seeds = [COMMUNITY_SEED, community.community_ref.as_ref()],
        bump = community.bump,
    )]
    pub community: Account<'info, CommunityAudit>,
}

pub fn handler(ctx: Context<VerifyCommunity>, verification_commitment: [u8; 32]) -> Result<()> {
    require!(
        verification_commitment != [0u8; 32],
        AuditError::ZeroCommitment
    );

    let community = &mut ctx.accounts.community;
    require!(
        community.status == CommunityStatus::Registered,
        AuditError::CommunityAlreadyVerified
    );
    community.status = CommunityStatus::Verified;
    community.verification_commitment = verification_commitment;
    community.verified_at = Clock::get()?.unix_timestamp;
    Ok(())
}
