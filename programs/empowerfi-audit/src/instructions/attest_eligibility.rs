use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
#[instruction(eligibility_no: u32)]
pub struct AttestEligibility<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    #[account(seeds = [BORROWER_SEED, borrower.borrower_ref_hash.as_ref()], bump = borrower.bump)]
    pub borrower: Account<'info, BorrowerAudit>,

    // Readiness first: the attestation this relies on must be CreditReady and hers.
    #[account(
        constraint = readiness.borrower == borrower.key() @ AuditError::ReadinessNotCreditReady,
        constraint = readiness.status == ReadinessStatus::CreditReady @ AuditError::ReadinessNotCreditReady,
    )]
    pub readiness: Account<'info, ReadinessAttestation>,

    #[account(
        init,
        payer = operator,
        space = 8 + EligibilityAttestation::INIT_SPACE,
        seeds = [ELIGIBILITY_SEED, borrower.key().as_ref(), &eligibility_no.to_le_bytes()],
        bump,
    )]
    pub eligibility: Account<'info, EligibilityAttestation>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AttestEligibility>,
    eligibility_no: u32,
    decision: EligibilityDecision,
    risk_band: Grade,
    confidence: Grade,
    model_version: u16,
    commitment: [u8; 32],
) -> Result<()> {
    require!(eligibility_no >= 1, AuditError::InvalidAssessmentNumber);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);

    let e = &mut ctx.accounts.eligibility;
    e.borrower = ctx.accounts.borrower.key();
    e.readiness = ctx.accounts.readiness.key();
    e.eligibility_no = eligibility_no;
    e.decision = decision;
    e.risk_band = risk_band;
    e.confidence = confidence;
    e.model_version = model_version;
    e.commitment = commitment;
    e.attested_at = Clock::get()?.unix_timestamp;
    e.schema_version = SCHEMA_VERSION;
    e.bump = ctx.bumps.eligibility;
    Ok(())
}
