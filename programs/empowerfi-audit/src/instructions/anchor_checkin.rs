use anchor_lang::prelude::*;

use crate::{
    constants::{BORROWER_SEED, CHECKIN_SEED, CONFIG_SEED, SCHEMA_VERSION},
    error::AuditError,
    state::{BorrowerAudit, CheckinCommitment, PlatformConfig},
};

/// YYYYMM within a sane range.
pub fn valid_period(period: u32) -> bool {
    let (year, month) = (period / 100, period % 100);
    (2020..=2100).contains(&year) && (1..=12).contains(&month)
}

#[derive(Accounts)]
#[instruction(period: u32)]
pub struct AnchorCheckin<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = operator @ AuditError::UnauthorizedOperator,
    )]
    pub config: Account<'info, PlatformConfig>,

    // Only a registered borrower reports a month.
    #[account(
        seeds = [BORROWER_SEED, borrower.borrower_ref_hash.as_ref()],
        bump = borrower.bump,
    )]
    pub borrower: Account<'info, BorrowerAudit>,

    // The month is part of the address: the same month cannot be anchored twice.
    #[account(
        init,
        payer = operator,
        space = 8 + CheckinCommitment::INIT_SPACE,
        seeds = [CHECKIN_SEED, borrower.key().as_ref(), &period.to_le_bytes()],
        bump,
    )]
    pub checkin: Account<'info, CheckinCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AnchorCheckin>, period: u32, commitment: [u8; 32]) -> Result<()> {
    require!(valid_period(period), AuditError::InvalidPeriod);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);

    let checkin = &mut ctx.accounts.checkin;
    checkin.borrower = ctx.accounts.borrower.key();
    checkin.period = period;
    checkin.commitment = commitment;
    checkin.anchored_at = Clock::get()?.unix_timestamp;
    checkin.schema_version = SCHEMA_VERSION;
    checkin.bump = ctx.bumps.checkin;
    Ok(())
}
