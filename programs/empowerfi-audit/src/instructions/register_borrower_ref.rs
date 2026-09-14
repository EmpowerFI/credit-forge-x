use anchor_lang::prelude::*;

use crate::{
    constants::{BORROWER_SEED, COMMUNITY_SEED, CONFIG_SEED, SCHEMA_VERSION},
    error::AuditError,
    state::{BorrowerAudit, CommunityAudit, CommunityStatus, PlatformConfig},
};

#[derive(Accounts)]
#[instruction(borrower_ref_hash: [u8; 32])]
pub struct RegisterBorrowerRef<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = operator @ AuditError::UnauthorizedOperator,
    )]
    pub config: Account<'info, PlatformConfig>,

    // A borrower only exists on-chain inside a verified community.
    #[account(
        seeds = [COMMUNITY_SEED, community.community_ref.as_ref()],
        bump = community.bump,
        constraint = community.status == CommunityStatus::Verified @ AuditError::CommunityNotVerified,
    )]
    pub community: Account<'info, CommunityAudit>,

    #[account(
        init,
        payer = operator,
        space = 8 + BorrowerAudit::INIT_SPACE,
        seeds = [BORROWER_SEED, borrower_ref_hash.as_ref()],
        bump,
    )]
    pub borrower: Account<'info, BorrowerAudit>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterBorrowerRef>,
    borrower_ref_hash: [u8; 32],
    enrollment_commitment: [u8; 32],
) -> Result<()> {
    require!(borrower_ref_hash != [0u8; 32], AuditError::ZeroReference);
    require!(
        enrollment_commitment != [0u8; 32],
        AuditError::ZeroCommitment
    );

    let borrower = &mut ctx.accounts.borrower;
    borrower.borrower_ref_hash = borrower_ref_hash;
    borrower.community = ctx.accounts.community.key();
    borrower.enrollment_commitment = enrollment_commitment;
    borrower.registered_at = Clock::get()?.unix_timestamp;
    borrower.schema_version = SCHEMA_VERSION;
    borrower.bump = ctx.bumps.borrower;
    Ok(())
}
