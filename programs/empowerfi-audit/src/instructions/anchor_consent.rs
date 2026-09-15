use anchor_lang::prelude::*;

use crate::{
    constants::{BORROWER_SEED, CONFIG_SEED, CONSENT_SEED, SCHEMA_VERSION},
    error::AuditError,
    state::{BorrowerAudit, ConsentCommitment, PlatformConfig},
};

#[derive(Accounts)]
#[instruction(consent_no: u32)]
pub struct AnchorConsent<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = operator @ AuditError::UnauthorizedOperator,
    )]
    pub config: Account<'info, PlatformConfig>,

    // Only a registered borrower gives consent.
    #[account(
        seeds = [BORROWER_SEED, borrower.borrower_ref_hash.as_ref()],
        bump = borrower.bump,
    )]
    pub borrower: Account<'info, BorrowerAudit>,

    // The record's number is part of the address: a record, once anchored,
    // cannot be replaced — a change of mind is the next number.
    #[account(
        init,
        payer = operator,
        space = 8 + ConsentCommitment::INIT_SPACE,
        seeds = [CONSENT_SEED, borrower.key().as_ref(), &consent_no.to_le_bytes()],
        bump,
    )]
    pub consent: Account<'info, ConsentCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AnchorConsent>, consent_no: u32, commitment: [u8; 32]) -> Result<()> {
    require!(consent_no >= 1, AuditError::InvalidConsentNumber);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);

    let consent = &mut ctx.accounts.consent;
    consent.borrower = ctx.accounts.borrower.key();
    consent.consent_no = consent_no;
    consent.commitment = commitment;
    consent.recorded_at = Clock::get()?.unix_timestamp;
    consent.schema_version = SCHEMA_VERSION;
    consent.bump = ctx.bumps.consent;
    Ok(())
}
